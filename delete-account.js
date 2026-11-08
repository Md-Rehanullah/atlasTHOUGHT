import { createClient } from "./assets/supabase-client.js";

const SUPABASE_URL = "https://ohvtqsjyvfctjapqpbtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odnRxc2p5dmZjdGphcHFwYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjI0MzMsImV4cCI6MjA3NDI5ODQzM30.eFZ2PzJP_DUJ9v1bwByJeIpAeafsTOYcRPjU2w1g4Ic";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const form = document.querySelector("#deletion-request-form");
const signInButton = document.querySelector("#deletion-sign-in");
const statusMessage = document.querySelector("#deletion-auth-status");
const verifiedAccount = document.querySelector("#deletion-verified-account");
const verifiedEmail = document.querySelector("#deletion-verified-email");
const reasonInput = document.querySelector("#deletion-reason");
const characterCount = document.querySelector("#deletion-char-count");
const submitButton = document.querySelector("#deletion-submit");
const errorMessage = document.querySelector("#deletion-error");
const successMessage = document.querySelector("#deletion-success");

let currentUser = null;
let submitting = false;
let submitted = false;

const isVerifiedGoogleAccount = (user) => Boolean(
  user?.email
  && user.email_confirmed_at
  && (user.app_metadata?.provider === "google"
    || user.identities?.some((identity) => identity.provider === "google")),
);

const showError = (message) => {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
};

const clearError = () => {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
};

const renderAuthState = () => {
  if (submitted) return;
  const verified = isVerifiedGoogleAccount(currentUser);
  statusMessage.textContent = verified
    ? "Your Google account is verified. You can now send a deletion request."
    : "Sign in with the verified Google account connected to your BRIDGE account.";
  statusMessage.hidden = false;
  signInButton.hidden = verified;
  signInButton.disabled = false;
  verifiedAccount.hidden = !verified;
  verifiedEmail.textContent = verified ? currentUser.email : "";
  reasonInput.disabled = !verified || submitting;
  submitButton.disabled = !verified || submitting;
  submitButton.textContent = submitting ? "Sending request…" : "Send deletion request";
};

signInButton.addEventListener("click", async () => {
  clearError();
  signInButton.disabled = true;
  signInButton.textContent = "Opening Google sign-in…";

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://www.atlasthought.dev/delete-account.html",
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) throw error;
  } catch {
    showError("We couldn't start Google sign-in. Please try again or contact atlasthoughthelp@gmail.com.");
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

  if (!isVerifiedGoogleAccount(currentUser)) {
    showError("Continue with the verified Google account connected to your BRIDGE account before submitting.");
    return;
  }

  submitting = true;
  renderAuthState();

  try {
    const { error } = await supabase.functions.invoke("request-account-deletion", {
      body: { reason: reasonInput.value.trim() },
    });

    if (error) {
      const status = error.context instanceof Response ? error.context.status : undefined;
      if (status === 429) {
        throw new Error("A deletion request was already submitted for this account recently. Contact support if you need help.");
      }
      throw new Error("We couldn't save your request. Check your connection and try again, or contact atlasthoughthelp@gmail.com.");
    }

    submitted = true;
    form.hidden = true;
    signInButton.hidden = true;
    verifiedAccount.hidden = true;
    statusMessage.hidden = true;
    successMessage.hidden = false;
    document.querySelector("#deletion-success-email").textContent = currentUser.email;
  } catch (error) {
    showError(error instanceof Error
      ? error.message
      : "We couldn't save your request. Please try again or contact atlasthoughthelp@gmail.com.");
  } finally {
    submitting = false;
    renderAuthState();
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  renderAuthState();
});

try {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  currentUser = sessionError ? null : session?.user ?? null;
} catch {
  currentUser = null;
}
renderAuthState();

if (window.location.hash.includes("access_token=")) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}
