export type RootStackParamList = {
  Compatibility: undefined;
  Blocked: {reasons: string[]};
  Download: undefined;
  Welcome: undefined;
  MainTabs: undefined;
  Chat: {conversationId: string; initialImageUri?: string; initialImageName?: string};
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Chats: undefined;
  Voice: undefined;
};
