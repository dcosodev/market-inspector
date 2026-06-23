import { beforeEach, describe, expect, it, vi } from "vitest";
import { Orchestrator } from "@/lib/agents/orchestrator";
import {
  detectAnomalies,
  type Anomaly,
} from "@/lib/agents/anomaly-detector";
import { generateBrief } from "@/lib/agents/brief-generator";

vi.mock("@/lib/agents/anomaly-detector", () => ({
  detectAnomalies: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/agents/brief-generator", () => ({
  generateBrief: vi.fn(),
}));

describe("Orchestrator", () => {
  const mockedDetectAnomalies = vi.mocked(detectAnomalies);
  const mockedGenerateBrief = vi.mocked(generateBrief);

  beforeEach(() => {
    mockedDetectAnomalies.mockReset();
    mockedDetectAnomalies.mockResolvedValue([]);
    mockedGenerateBrief.mockReset();
  });

  it("increments state and emits after a tick", async () => {
    const orchestrator = new Orchestrator();
    const emissions: number[] = [];
    const unsubscribe = orchestrator.subscribe((state) => {
      emissions.push(state.tickCount);
    });

    const state = await orchestrator.tick();
    unsubscribe();

    expect(state.tickCount).toBe(1);
    expect(orchestrator.latestState().tickCount).toBe(1);
    expect(emissions.length).toBeGreaterThanOrEqual(1);
    expect(emissions[0]).toBe(1);
  });

  it("reuses an active detection tick instead of starting a concurrent scan", async () => {
    let resolveDetection: ((value: Anomaly[]) => void) | undefined;
    mockedDetectAnomalies.mockImplementationOnce(
      () =>
        new Promise<Anomaly[]>((resolve) => {
          resolveDetection = resolve;
        })
    );
    const orchestrator = new Orchestrator();

    const first = orchestrator.tick();
    const second = orchestrator.tick();

    expect(mockedDetectAnomalies).toHaveBeenCalledTimes(1);
    resolveDetection?.([]);

    const [firstState, secondState] = await Promise.all([first, second]);
    expect(firstState.tickCount).toBe(1);
    expect(secondState.tickCount).toBe(1);
  });

  it("coalesces concurrent forced briefs into one Gemini request", async () => {
    const anomaly: Anomaly = {
      id: "btc-test",
      detectedAt: new Date().toISOString(),
      asset: { symbol: "BTC", name: "Bitcoin", type: "crypto" },
      metric: "priceChange24h",
      value: 5,
      threshold: 2,
      severity: "medium",
      summary: "Bitcoin moved 5%",
      priceUsd: 60_000,
    };
    let resolveDetection: ((value: Anomaly[]) => void) | undefined;
    mockedDetectAnomalies.mockImplementationOnce(
      () =>
        new Promise<Anomaly[]>((resolve) => {
          resolveDetection = resolve;
        })
    );
    mockedGenerateBrief.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      model: "gemini-3.5-flash",
      headline: "BITCOIN MOVED 5%",
      body: "Test analysis.",
      actions: [],
      toolCalls: [],
    });
    const orchestrator = new Orchestrator();

    const first = orchestrator.tick({ forceBrief: true });
    const second = orchestrator.tick({ forceBrief: true });
    resolveDetection?.([anomaly]);

    await Promise.all([first, second]);
    expect(mockedDetectAnomalies).toHaveBeenCalledTimes(1);
    expect(mockedGenerateBrief).toHaveBeenCalledTimes(1);
  });

  it("stores a brief-generation failure in the orchestrator state", async () => {
    mockedDetectAnomalies.mockResolvedValue([
      {
        id: "eth-test",
        detectedAt: new Date().toISOString(),
        asset: { symbol: "ETH", name: "Ethereum", type: "crypto" },
        metric: "priceChange24h",
        value: -4,
        threshold: 2,
        severity: "medium",
        summary: "Ethereum moved -4%",
        priceUsd: 3_000,
      },
    ]);
    mockedGenerateBrief.mockRejectedValue(new Error("Gemini quota exceeded"));
    const orchestrator = new Orchestrator();

    const state = await orchestrator.tick({ forceBrief: true });

    expect(state.lastError).toBe("Gemini quota exceeded");
  });
});
