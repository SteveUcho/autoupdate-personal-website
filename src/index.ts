// These are the dependencies for this file.
//
// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import { App } from "octokit";
import { createWebMiddleware } from "@octokit/webhooks";

// This assigns the values of your environment variables to local variables.
const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKey = process.env.PRIVATE_KEY;

const cloudflareDeployWebhook = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;

if (!appId || !webhookSecret || !privateKey || !cloudflareDeployWebhook) {
	throw new Error("Missing required environment variables");
}

// This creates a new instance of the Octokit App class.
const app = new App({
	appId: appId,
	privateKey: privateKey,
	webhooks: {
		secret: webhookSecret
	},
});

async function deployCloudFlare() {
	if (!cloudflareDeployWebhook) {
		throw new Error("Missing required environment variables");
	}
	try {
		console.log("Calling Cloudflare deploy webhook...");
		const res = await fetch(cloudflareDeployWebhook, { method: "POST" });
		console.log("Cloudflare deploy webhook response:", res);
	} catch (error) {
		console.error("Error calling Cloudflare deploy webhook:", error);
	}
}

app.webhooks.on("push", ({ payload }) => {
	console.log(`Received a push event for ${payload.repository.name}`);
	deployCloudFlare();
});

app.webhooks.on("repository", ({ payload }) => {
	console.log(`Received a repository event for ${payload.repository.name} with action ${payload.action}`);
	if (payload.action === "created" || payload.action === "deleted") {
		deployCloudFlare();
	}
});

// This logs any errors that occur.
app.webhooks.onError((error) => {
	if (error.name === "AggregateError") {
		console.error(`Error processing request: ${JSON.stringify(error.event)}`);
	} else {
		console.error(error);
	}
});

// This determines where your server will listen.
const port = process.env.PORT || 3000;
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const webhookPath = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${webhookPath}`;

// This sets up a middleware function to handle incoming webhook events.
//
// Octokit's `createWebMiddleware` function takes care of generating this middleware function for you. The resulting middleware function will:
//
// - Check the signature of the incoming webhook event to make sure that it matches your webhook secret. This verifies that the incoming webhook event is a valid GitHub event.
// - Parse the webhook event payload and identify the type of event.
// - Trigger the corresponding webhook event handler.
const middleware = createWebMiddleware(app.webhooks, { path: webhookPath });

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const response = await middleware(request);

		if (response) {
			return response;
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

console.log(`Server is listening for events at: ${localWebhookUrl}`);
console.log('Press Ctrl + C to quit.');
