import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import { prisma } from "../../../src/config/prisma-client.mts";
import { RestTimerRepository } from "../../../src/modules/push/repository/rest-timer-repository.mts";
import {
  TEST_EMAIL,
  cleanupTestUser,
  createTestUser,
} from "../helpers.mts";

const subscription = {
  endpoint: "https://push.example.com/subscriptions/one",
  keys: { p256dh: "p256dh-value", auth: "auth-value" },
};

const jsonHeaders = { "Content-Type": "application/json" };

async function currentUserId(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: TEST_EMAIL },
  });
  return user.id;
}

function postSubscription(body: unknown) {
  return app.request("/api/push/subscriptions", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

describe("push API", () => {
  beforeEach(async () => {
    await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestUser();
  });

  it("serves the VAPID public key", async () => {
    const response = await app.request("/api/push/vapid-public-key");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      publicKey: process.env.VAPID_PUBLIC_KEY,
    });
  });

  it("stores a push subscription for the current user", async () => {
    const response = await postSubscription(subscription);

    expect(response.status).toBe(204);
    const stored = await prisma.pushSubscription.findMany({
      where: { userId: await currentUserId() },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  });

  it("updates the keys when the same endpoint subscribes again", async () => {
    await postSubscription(subscription);
    await postSubscription({
      ...subscription,
      keys: { p256dh: "new-p256dh", auth: "new-auth" },
    });

    const stored = await prisma.pushSubscription.findMany({
      where: { userId: await currentUserId() },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      p256dh: "new-p256dh",
      auth: "new-auth",
    });
  });

  it("removes a subscription by endpoint", async () => {
    await postSubscription(subscription);

    const response = await app.request(
      `/api/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      { method: "DELETE" }
    );

    expect(response.status).toBe(204);
    expect(
      await prisma.pushSubscription.count({
        where: { userId: await currentUserId() },
      })
    ).toBe(0);
  });

  it("rejects a subscription without a JSON body", async () => {
    const response = await app.request("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(subscription),
    });

    expect(response.status).toBe(415);
  });

  it("rejects a malformed subscription", async () => {
    const response = await postSubscription({
      endpoint: "http://push.example.com/subscriptions/one",
      keys: { p256dh: "", auth: "" },
    });

    expect(response.status).toBe(422);
  });

  it("stores the pending rest timer", async () => {
    const endAt = new Date(Date.now() + 120_000).toISOString();

    const response = await app.request("/api/push/rest-timer", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ endAt }),
    });

    expect(response.status).toBe(204);
    const stored = await prisma.restTimer.findMany({
      where: { userId: await currentUserId() },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.endAt.toISOString()).toBe(endAt);
  });

  it("replaces the pending rest timer for the same user", async () => {
    const first = new Date(Date.now() + 120_000).toISOString();
    const second = new Date(Date.now() + 180_000).toISOString();

    for (const endAt of [first, second]) {
      await app.request("/api/push/rest-timer", {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ endAt }),
      });
    }

    const stored = await prisma.restTimer.findMany({
      where: { userId: await currentUserId() },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.endAt.toISOString()).toBe(second);
  });

  it("cancels the pending rest timer", async () => {
    await app.request("/api/push/rest-timer", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ endAt: new Date().toISOString() }),
    });

    const response = await app.request("/api/push/rest-timer", {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(
      await prisma.restTimer.count({ where: { userId: await currentUserId() } })
    ).toBe(0);
  });

  it("deletes a rest timer only if it still has the scheduled end", async () => {
    const userId = await currentUserId();
    const endAt = new Date(Date.now() + 120_000);
    const restarted = new Date(Date.now() + 180_000);
    const timer = await prisma.restTimer.create({ data: { userId, endAt } });
    await prisma.restTimer.update({
      where: { id: timer.id },
      data: { endAt: restarted },
    });

    const repository = new RestTimerRepository();
    await repository.deleteIfUnchanged(timer.id, endAt);
    expect(
      await prisma.restTimer.findUnique({ where: { id: timer.id } })
    ).not.toBeNull();

    await repository.deleteIfUnchanged(timer.id, restarted);
    expect(
      await prisma.restTimer.findUnique({ where: { id: timer.id } })
    ).toBeNull();
  });

  it("rejects a malformed rest timer", async () => {
    const response = await app.request("/api/push/rest-timer", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ endAt: "soon" }),
    });

    expect(response.status).toBe(422);
  });
});
