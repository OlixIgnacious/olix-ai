import Foundation
import MediaPipeTasksGenai

// MARK: - OlixLLMModule

/// React Native native module that wraps MediaPipe LLM Inference.
///
/// Registered as "OlixLLM" via the ObjC bridge in OlixLLMModule.mm.
/// Streaming tokens are delivered as "OlixLLM_token" NativeEventEmitter events.
///
/// Thread model
/// ───────────
/// All MediaPipe operations run on `llmQueue` (background, userInitiated QoS).
/// Event emission is thread-safe — RCTEventEmitter handles marshalling.
@objc(OlixLLM)
final class OlixLLMModule: RCTEventEmitter {

  // MARK: Events

  static let tokenEvent = "OlixLLM_token"
  static let doneEvent  = "OlixLLM_done"
  static let errorEvent = "OlixLLM_error"

  override func supportedEvents() -> [String]! {
    [Self.tokenEvent, Self.doneEvent, Self.errorEvent]
  }

  // MARK: State

  private var inference: LlmInference?
  private var isCancelled = false
  private let llmQueue = DispatchQueue(label: "com.olix.llm", qos: .userInitiated)

  // MARK: - loadModel

  /// Loads the Gemma model from `path` into memory.
  /// Safe to call from JS; runs entirely on `llmQueue`.
  @objc func loadModel(
    _ path: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    llmQueue.async { [weak self] in
      guard let self else { return }

      do {
        let options = LlmInference.Options(modelPath: path)
        options.maxTokens = 1024
        options.topk = 40
        options.temperature = 0.8
        options.randomSeed = 102

        let newInference = try LlmInference(options: options)
        self.inference = newInference
        resolve(nil)
      } catch {
        reject("LOAD_MODEL_FAILED", error.localizedDescription, error)
      }
    }
  }

  // MARK: - generateStream

  /// Begins streaming generation for `prompt`.
  ///
  /// Each partial token is emitted as an `OlixLLM_token` event with payload
  /// `{ token: String }`. The promise resolves when generation completes or
  /// rejects if an error occurs.
  ///
  /// Call `stopGeneration()` to suppress further tokens (generation continues
  /// natively but events are discarded and the promise is not resolved).
  @objc func generateStream(
    _ prompt: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    llmQueue.async { [weak self] in
      guard let self else { return }

      guard let inference = self.inference else {
        reject("MODEL_NOT_LOADED", "Call loadModel before generateStream", nil)
        return
      }

      self.isCancelled = false

      do {
        try inference.generateResponseAsync(
          inputText: prompt,
          progress: { [weak self] partialResponse, error in
            guard let self else { return }

            if let error {
              if !self.isCancelled {
                self.sendEvent(
                  withName: Self.errorEvent,
                  body: ["error": error.localizedDescription]
                )
                reject("GENERATION_ERROR", error.localizedDescription, error)
              }
              return
            }

            if self.isCancelled { return }

            if let token = partialResponse, !token.isEmpty {
              self.sendEvent(
                withName: Self.tokenEvent,
                body: ["token": token]
              )
            }
          },
          completion: { [weak self] in
            guard let self else { return }
            if !self.isCancelled {
              self.sendEvent(withName: Self.doneEvent, body: nil)
              resolve(nil)
            }
          }
        )
      } catch {
        reject("GENERATION_FAILED", error.localizedDescription, error)
      }
    }
  }

  // MARK: - stopGeneration

  /// Suppresses further token events and prevents the promise from resolving.
  /// The underlying MediaPipe session runs to natural completion.
  @objc func stopGeneration() {
    isCancelled = true
  }

  // MARK: - RCTEventEmitter

  override static func requiresMainQueueSetup() -> Bool { false }
}
