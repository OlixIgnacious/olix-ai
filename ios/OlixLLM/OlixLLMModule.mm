#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Registers the Swift class OlixLLMModule with the React Native bridge
// under the module name "OlixLLM".
RCT_EXTERN_MODULE(OlixLLM, RCTEventEmitter)

RCT_EXTERN_METHOD(
  loadModel:(NSString *)path
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  generateStream:(NSString *)prompt
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(stopGeneration)
