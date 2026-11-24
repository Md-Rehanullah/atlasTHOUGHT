import { createClient } from "./assets/supabase-client.js";
import {
  RAFIQ_SUPABASE_URL,
  RAFIQ_SUPABASE_PUBLISHABLE_KEY,
} from "./assets/rafiq-supabase-config.js";

const BRIDGE_URL = "https://ohvtqsjyvfctjapqpbtf.supabase.co";
const BRIDGE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odnRxc2p5dmZjdGphcHFwYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjI0MzMsImV4cCI6MjA3NDI5ODQzM30.eFZ2PzJP_DUJ9v1bwByJeIpAeafsTOYcRPjU2w1g4Ic";
const redirectBase = "https://www.atlasthought.dev/delete-account.html";

const clients = {
  bridge: createClient(BRIDGE_URL, BRIDGE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  }),
  rafiq: createClient(RAFIQ_SUPABASE_URL, RAFIQ_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  }),
};

const appSelect = document.querySelector("#deletion-app");
const intro = document.querySelector("#deletion-intro");
const inAppText = document.querySelector("#deletion-in-app");
const timingText = document.querySelector("#deletion-timing");
const dataText = document.querySelector("#deletion-data");
const form = document.querySelector("#deletion-request-form");
const signInButton = document.querySelector("#deletion-sign-in");
const statusMessage = document.querySelector("#deletion-auth-status");
const verifiedAccount = document.querySelector("#deletion-verified-account");
const verifiedLabel = document.querySelector("#deletion-verified-label");
const verifiedEmail = document.querySelector("#deletion-verified-email");
const reasonInput = document.querySelector("#deletion-reason");
const characterCount = document.querySelector("#deletion-char-count");
const submitButton = document.querySelector("#deletion-submit");
const errorMessage = document.querySelector("#deletion-error");
const successMessage = document.querySelector("#deletion-success");
const successCopy = document.querySelector("#deletion-success-copy");
const successFollowup = document.querySelector("#deletion-success-followup");
const privacyLink = document.querySelector("#deletion-privacy-link");
const supportLink = document.querySelector("#deletion-support-link");

let activeApp = "bridge";
let currentUser = null;
let accountCheck = "signed_out";
let submitting = false;
let submitted = false;
let checkSequence = 0;

const getClient = () => clients[activeApp];
const appName = () => activeApp === "rafiq" ? "Rafiq" : "BRIDGE";
const isVerifiedGoogleAccount = (user) => Boolean(
  user?.email
  && user.email_confirmed_at
  && (user.app_metadata?.provider === "google"
    || user.identities?.some((identity) => identity.provider === "google")),
);
const isEligible = () => isVerifiedGoogleAccount(currentUser) && accountCheck === "found";

function configureAppContent() {
  const isRafiq = activeApp === "rafiq";
  document.title = `${isRafiq ? "Rafiq" : "BRIDGE"} Account Deletion Request | atlasTHOUGHT`;
  intro.textContent = `Choose ${isRafiq ? "Rafiq" : "BRIDGE"}, then continue with the Google account you used in that app. Google handles sign-in; this page never asks for your Google password. We check that the account has completed setup in the selected app before accepting a request.`;
  inAppText.innerHTML = isRafiq
    ? "You can also use Rafiq’s in-app account-deletion option, if available in your installed version."
    : "If you can still sign in to BRIDGE, you can delete your account in the app from <strong>Profile, then Settings, then Delete my account</strong>.";
  timingText.textContent = isRafiq
    ? "This form records a request for review; it does not immediately delete your account."
    : "After support verifies an external request, we aim to complete it within 7 business days.";
  dataText.textContent = isRafiq
    ? "Rafiq account deletion removes the account and its cloud-synced profile, preferences, and saved items. Limited records may be retained where required for safety, security, fraud prevention, or legal reasons."
    : "Account deletion removes associated profile data, posts, comments, interactions, and account media, except limited records that may need to be kept for safety, security, fraud prevention, or legal reasons.";
  verifiedLabel.textContent = `Verified ${isRafiq ? "Rafiq" : "BRIDGE"} Google account`;
  privacyLink.href = isRafiq ? "rafiq-privacy.html" : "privacy.html";
  privacyLink.textContent = isRafiq ? "Rafiq Privacy Policy" : "BRIDGE Privacy Policy";
  supportLink.href = isRafiq ? "mailto:rafiqsupport@atlasthought.dev" : "mailto:bridgesupport@atlasthought.dev";
  supportLink.textContent = isRafiq ? "rafiqsupport@atlasthought.dev" : "bridgesupport@atlasthought.dev";
  successCopy.innerHTML = `Your verified ${isRafiq ? "Rafiq" : "BRIDGE"} account deletion request has been received. We may contact you at <strong id="deletion-success-email"></strong> if more information is needed.`;
  successFollowup.textContent = "This request is reviewed by the selected app's support team. It does not immediately delete the account. You can still use the in-app deletion option when available.";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function statusText() {
  if (accountCheck === "checking") return `Checking whether this Google account has a completed ${appName()} account...`;
  if (accountCheck === "found") return `We found your ${appName()} account. You can send a deletion request; the reason is optional.`;
  if (accountCheck === "not_found") return `Account not found in ${appName()}. Check the selected app and continue with the Google account used for that app.`;
  if (accountCheck === "not_google") return "Continue with the Google account you used to create your account in this app.";
  if (accountCheck === "error") return `We couldn't verify this account in ${appName()}. Please try again.`;
  return `Choose ${appName()}, then continue with Google to check that app's account.`;
}

function renderAuthState() {
  if (submitted) return;
  const eligible = isEligible();
  statusMessage.textContent = statusText();
  statusMessage.hidden = false;
  signInButton.hidden = false;
  signInButton.disabled = submitting || accountCheck === "checking";
  signInButton.textContent = currentUser ? "Continue with another Google account" : "Continue with Google";
  verifiedAccount.hidden = !eligible;
  verifiedEmail.textContent = eligible ? currentUser.email : "";
  form.hidden = !eligible;
  reasonInput.disabled = !eligible || submitting;
  submitButton.disabled = !eligible || submitting;
  submitButton.textContent = submitting ? "Sending request..." : "Send deletion request";
}

async function parseFunctionError(error) {
  const response = error?.context;
  let body = {};
  if (response instanceof Response) {
    try { body = await response.clone().json(); } catch { /* The status is still useful. */ }
  }
  return { status: response?.status, code: body?.code, message: body?.error };
}

async function verifyAccount(user = currentUser) {
  const sequence = ++checkSequence;
  if (!isVerifiedGoogleAccount(user)) {
    accountCheck = user ? "not_google" : "signed_out";
    renderAuthState();
    return;
  }
  accountCheck = "checking";
  renderAuthState();
  try {
    const { error } = await getClient().functions.invoke("request-account-deletion", {
      body: { action: "verify" },
    });
    if (sequence !== checkSequence) return;
    if (!error) {
      accountCheck = "found";
    } else {
      const failure = await parseFunctionError(error);
      if (sequence !== checkSequence) return;
      accountCheck = failure.code === "ACCOUNT_NOT_FOUND"
        ? "not_found"
        : failure.status === 401 ? "not_google" : "error";
    }
  } catch {
    if (sequence !== checkSequence) return;
    accountCheck = "error";
  }
  renderAuthState();
}

async function loadActiveSession() {
  const sequence = ++checkSequence;
  currentUser = null;
  accountCheck = "signed_out";
  renderAuthState();
  try {
    const { data: { session }, error } = await getClient().auth.getSession();
    if (sequence !== checkSequence) return;
    currentUser = error ? null : session?.user ?? null;
  } catch {
    if (sequence !== checkSequence) return;
    currentUser = null;
  }
  await verifyAccount(currentUser);
}

signInButton.addEventListener("click", async () => {
  clearError();
  signInButton.disabled = true;
  signInButton.textContent = "Opening Google sign-in...";
  try {
    const redirectTo = activeApp === "rafiq" ? `${redirectBase}?app=rafiq` : redirectBase;
    const { error } = await getClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  } catch {
    accountCheck = "error";
    statusMessage.textContent = `We couldn't start Google sign-in for ${appName()}. Please try again or contact support.`;
    signInButton.textContent = "Continue with Google";
    signInButton.disabled = false;
  }
});

reasonInput.addEventListener("input", () => {
  characterCount.textContent = `${reasonInput.value.length}/1000`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  if (!isEligible()) {
    accountCheck = "error";
    renderAuthState();
    return;
  }
  submitting = true;
  renderAuthState();
  try {
    const { error } = await getClient().functions.invoke("request-account-deletion", {
      body: { action: "submit", reason: reasonInput.value.trim() },
    });
    if (error) {
      const failure = await parseFunctionError(error);
      if (failure.code === "ACCOUNT_NOT_FOUND") {
        accountCheck = "not_found";
        renderAuthState();
        return;
      }
      if (failure.status === 409 || failure.status === 429) {
        throw new Error(failure.message || "A deletion request is already pending or was sent recently. Contact support if you need help.");
      }
      throw new Error("We couldn't save your request. Check your connection and try again, or contact support.");
    }
    const requestEmail = currentUser.email;
    submitted = true;
    form.hidden = true;
    signInButton.hidden = true;
    verifiedAccount.hidden = true;
    statusMessage.hidden = true;
    successMessage.hidden = false;
    document.querySelector("#deletion-success-email").textContent = requestEmail;
    await getClient().auth.signOut();
  } catch (error) {
    showError(error instanceof Error ? error.message : "We couldn't save your request. Please try again or contact support.");
  } finally {
    submitting = false;
    if (!submitted) renderAuthState();
  }
});

for (const [app, client] of Object.entries(clients)) {
  client.auth.onAuthStateChange((_event, session) => {
    if (app !== activeApp || submitted) return;
    currentUser = session?.user ?? null;
    accountCheck = currentUser ? "checking" : (accountCheck === "not_found" ? "not_found" : "signed_out");
    renderAuthState();
    if (currentUser) {
      const userId = currentUser.id;
      setTimeout(() => {
        if (app === activeApp && currentUser?.id === userId) void verifyAccount(currentUser);
      }, 0);
    }
  });
}

appSelect.addEventListener("change", async () => {
  activeApp = appSelect.value;
  submitted = false;
  form.hidden = true;
  form.reset();
  characterCount.textContent = "0/1000";
  successMessage.hidden = true;
  clearError();
  configureAppContent();
  await loadActiveSession();
});

const requestedApp = new URLSearchParams(window.location.search).get("app");
if (requestedApp === "rafiq" || requestedApp === "bridge") appSelect.value = requestedApp;
activeApp = appSelect.value;
configureAppContent();
await loadActiveSession();

if (window.location.hash.includes("access_token=") || window.location.hash.includes("error_description=")) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}
