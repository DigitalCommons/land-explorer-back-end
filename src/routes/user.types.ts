type UpdateUserGuidePromptSeenPayload = {
  userGuidePromptSeen: boolean;
  viewedUserGuide: boolean;
  viewedSource: string;
};

export type GetUpdateHasSeenUserGuideRequest = Request & {
  auth: {
    credentials: {
      user_id: number;
    };
  };
  payload: UpdateUserGuidePromptSeenPayload;
};
