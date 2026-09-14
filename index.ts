// These are the dependencies for this file.
//
// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import { App } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import fs from "fs";
import http from "http";

// This assigns the values of your environment variables to local variables.
const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;

if (!appId || !webhookSecret || !privateKeyPath) {
  throw new Error("Missing required environment variables");
}

// This reads the contents of your private key file.
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// This creates a new instance of the Octokit App class.
const app = new App({
  appId: appId,
  privateKey: privateKey,
  webhooks: {
    secret: webhookSecret
  },
});

app.webhooks.on("push", async ({ octokit, payload }) => {
  console.log(`Received a push event for ${payload.repository.name}`);

  try {
    await octokit.rest.repos.createDispatchEvent({
      owner: payload.repository.owner?.login || "",
      repo: "personal-website",
      event_type: "deploy",
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      const err = error as { response: { status: number; data: { message: string } } };
      console.error(`Error! Status: ${err.response.status}. Message: ${err.response.data.message}`)
    }
    console.error(error)
  }
});

// This logs any errors that occur.
app.webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
  } else {
    console.error(error);
  }
});

// This determines where your server will listen.
//
// For local development, your server will listen to port 3000 on `localhost`. When you deploy your app, you will change these values. For more information, see [Deploy your app](#deploy-your-app).
const port = 3000;
const host = 'localhost';
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

// This sets up a middleware function to handle incoming webhook events.
//
// Octokit's `createNodeMiddleware` function takes care of generating this middleware function for you. The resulting middleware function will:
//
// - Check the signature of the incoming webhook event to make sure that it matches your webhook secret. This verifies that the incoming webhook event is a valid GitHub event.
// - Parse the webhook event payload and identify the type of event.
// - Trigger the corresponding webhook event handler.
const middleware = createNodeMiddleware(app.webhooks, { path });

// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`);
  console.log('Press Ctrl + C to quit.')
});
