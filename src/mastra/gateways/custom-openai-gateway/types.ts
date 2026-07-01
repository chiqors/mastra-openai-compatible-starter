export type OpenAICompatibleModelsResponse = {
  data?: Array<{
    id?: string;
    supported_endpoint_types?: string[];
  }>;
};
