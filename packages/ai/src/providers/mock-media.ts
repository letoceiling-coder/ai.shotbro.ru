export type MockMediaJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type MockMediaJob = {
  providerJobId: string;
  kind: "image" | "video" | "audio";
  status: MockMediaJobStatus;
  mock: true;
  sceneId?: string;
  fixtureKey: string;
};

const FIXTURES = {
  image: "mock/fixture-640x360.png",
  video: "mock/fixture-640x360.mp4",
  audio: "mock/fixture-voice.mp3",
} as const;

export class MockImageProvider {
  async submit(input: { sceneId: string; prompt: string }): Promise<MockMediaJob> {
    return {
      providerJobId: `mock-img-${input.sceneId}`,
      kind: "image",
      status: "QUEUED",
      mock: true,
      sceneId: input.sceneId,
      fixtureKey: FIXTURES.image,
    };
  }

  async poll(job: MockMediaJob): Promise<MockMediaJob> {
    return { ...job, status: "COMPLETED" };
  }
}

export class MockVideoProvider {
  async submit(input: { sceneId: string; imageJobId: string }): Promise<MockMediaJob> {
    return {
      providerJobId: `mock-vid-${input.sceneId}`,
      kind: "video",
      status: "QUEUED",
      mock: true,
      sceneId: input.sceneId,
      fixtureKey: FIXTURES.video,
    };
  }

  async poll(job: MockMediaJob): Promise<MockMediaJob> {
    return { ...job, status: "COMPLETED" };
  }
}

export class MockAudioProvider {
  async submit(input: { durationSeconds: number }): Promise<MockMediaJob> {
    return {
      providerJobId: `mock-aud-${Math.round(input.durationSeconds)}`,
      kind: "audio",
      status: "QUEUED",
      mock: true,
      fixtureKey: FIXTURES.audio,
    };
  }

  async poll(job: MockMediaJob): Promise<MockMediaJob> {
    return { ...job, status: "COMPLETED" };
  }
}
