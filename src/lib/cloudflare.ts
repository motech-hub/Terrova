export type GenerationWorkflowBinding = {
  create(input: {
    id?: string;
    params: { jobId: string };
  }): Promise<{ id: string }>;
};

export type TerrovaBindings = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  GENERATION_WORKFLOW?: GenerationWorkflowBinding;
};

let currentBindings: TerrovaBindings = {};

export function setCloudflareBindings(bindings: unknown) {
  currentBindings = bindings as TerrovaBindings;
}

export function getCloudflareBindings() {
  return currentBindings;
}
