import { deletePushSubscription, getPushKey, savePushSubscription } from "./api";

/** Alerts while the app is closed need a service worker and a push service; insecure origins get neither. */
export const pushSupported =
    typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The key browsers subscribe with, or null when the server has push turned off. */
export async function serverKey() {
    return (await getPushKey()).public_key;
}

/** This browser's subscription, if any. Never registers the worker. */
async function current() {
    if (!pushSupported) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Whether this browser is subscribed. If it is, files it under whoever is signed in now,
 * so a shared browser never keeps alerting the last person.
 */
export async function syncSubscription() {
    const subscription = await current();
    if (subscription) await savePushSubscription(subscription.toJSON());
    return subscription !== null;
}

/** Asks for permission, then subscribes this browser for the signed-in person. */
export async function subscribe(key: string) {
    // First, while the click still counts as the person's own; some browsers insist.
    if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications aren't allowed");
    await navigator.serviceWorker.register("/sw.js");
    // Subscribing needs an active worker; ready waits for one.
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await savePushSubscription(subscription.toJSON());
}

/** Stops alerts to this browser. The browser side ends even if the server can't be told. */
export async function unsubscribe() {
    const subscription = await current();
    if (!subscription) return;
    try {
        await deletePushSubscription(subscription.endpoint);
    } finally {
        // A dead endpoint answers 410, and the server forgets it then.
        await subscription.unsubscribe();
    }
}
