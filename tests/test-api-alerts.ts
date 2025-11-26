import "dotenv/config";
import { GET, POST } from "../app/api/user/alerts/route";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";

// Mock NextRequest
class MockRequest extends NextRequest {
    constructor(url: string, init?: RequestInit) {
        super(new Request(url, init));
    }
}

async function main() {
    console.log("Testing API Route...");

    const testUserId = "did:privy:test-api-user";

    // Cleanup
    await prisma.userAlertSettings.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    // Test POST (Create)
    console.log("Testing POST...");
    const postReq = new MockRequest("http://localhost/api/user/alerts", {
        method: "POST",
        headers: { "x-user-did": testUserId },
        body: JSON.stringify({
            discordWebhook: "https://discord.com/api/webhooks/123/abc",
            alertTypes: ["WHALE_MOVEMENT"],
            wallets: [],
            markets: []
        })
    });

    const postRes = await POST(postReq);
    const postData = await postRes.json();
    console.log("POST Result:", postData);

    if (postData.discordWebhook !== "https://discord.com/api/webhooks/123/abc") {
        throw new Error("POST failed to save webhook");
    }

    // Test GET (Read)
    console.log("Testing GET...");
    const getReq = new MockRequest("http://localhost/api/user/alerts", {
        headers: { "x-user-did": testUserId }
    });

    const getRes = await GET(getReq);
    const getData = await getRes.json();
    console.log("GET Result:", getData);

    if (getData.discordWebhook !== "https://discord.com/api/webhooks/123/abc") {
        throw new Error("GET failed to retrieve webhook");
    }

    console.log("API Route Test Passed!");

    // Cleanup
    await prisma.userAlertSettings.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
}

main().catch(console.error);
