import { handle, ok, jsonBody, str, BadRequest } from "@/lib/server/respond";
import {
  getUserProfile, createUserProfile, ensureUserProfile, updateUserProfile,
  claimAdminInvite, touchAdminActivity, ownsVideoFile,
} from "@/lib/server/repo";
import { requireUid, requireVerifiedUid, requireIdentity, isAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* A recruiter always gets a usable name. Firebase only carries `name` when the
   account has a displayName, and an empty one leaves the dashboard greeting
   and every submission credited to a blank. The email local part is a poor
   name but a real one, and the profile page invites them to correct it. */
function displayName(name: string, email: string): string {
  return name.trim() || email.split("@")[0] || "Recruiter";
}

/** The caller's own profile, plus whether they're an admin.
 *
 *  Verifying your email is what makes you a recruiter here. A signed-in
 *  account with a verified email and no profile row gets one created from the
 *  token; an unverified one gets `profile: null` and stays out of the
 *  recruiter table entirely. `profile` is therefore null for exactly two
 *  cases: an admin-only account, and someone who has not clicked the link yet.
 *
 *  WHY VERIFICATION GATES THE ROW, NOT JUST THE ACTIONS
 *
 *  It used to create the row on any sign-in. Creating a Firebase account
 *  costs a bot nothing — an address it does not own is fine, because it never
 *  needs to read the mail — so the console's recruiter list filled with
 *  signups that had a plausible harvested email, a random name, and no way to
 *  ever do anything (every write already goes through requireVerifiedUid).
 *  Dozens of rows an admin had to read and delete, for accounts that were
 *  never going to become real.
 *
 *  Deferring the row costs a genuine recruiter nothing: DashboardGate shows
 *  them the verify-email screen before it ever looks at the profile, and the
 *  row appears the moment they come back from the link. The name they typed
 *  at signup is on the Firebase account as displayName, so it arrives in the
 *  token and is not lost by the wait. */
export function GET(req: Request) {
  return handle(async () => {
    const { uid, email, name, emailVerified } = await requireIdentity(req);
    const [existing, alreadyAdmin] = await Promise.all([
      getUserProfile(uid),
      isAdmin(uid),
    ]);

    // A signed-in account that isn't yet an admin might be exactly who a
    // pending invite was for — claim it now rather than making them wait for
    // some other trigger. Cheap: one indexed lookup by email when it misses.
    const admin = alreadyAdmin || (await claimAdminInvite(uid, email, displayName(name, email)));

    /* "Last seen" bookkeeping, and nothing depends on it. It used to be
       awaited bare, which meant a failed UPDATE here - a missing column after
       a partial migration, a locked row, the shared host dropping the
       connection - threw out of the whole handler and returned 500. The only
       people who reach this line are admins, so the effect was that admins,
       and only admins, were locked out of the console by a write whose result
       nobody reads. Log it and carry on. */
    if (admin) {
      try {
        await touchAdminActivity(uid);
      } catch (err) {
        console.error("[api/me] touchAdminActivity failed for", uid, err);
      }
    }

    const profile =
      existing ??
      (admin || !emailVerified
        ? null
        : await ensureUserProfile(uid, displayName(name, email), email));

    return ok({ profile, isAdmin: admin });
  });
}

/* Create the caller's profile. uid comes from the token.
 *
 * Verified callers only, for the same reason as GET: without it this is an
 * open door to the recruiter table for anyone holding a freshly minted
 * Firebase account, which is free to create against any address.
 *
 * The signup flow still calls this and still ignores a failure (see
 * lib/auth.tsx). That is now the normal path rather than an edge case: the
 * call is refused at signup because nobody has clicked anything yet, and the
 * row is created by GET /api/me on the first load after verification. */
export function POST(req: Request) {
  return handle(async () => {
    const uid = await requireVerifiedUid(req);
    const body = await jsonBody(req);
    await createUserProfile(
      uid,
      str(body.name, "name", { max: 255, required: true }),
      str(body.email, "email", { max: 320, required: true }),
    );
    return ok(await getUserProfile(uid), { status: 201 });
  });
}

/** Update the caller's own profile. Cannot touch uid, email or created_at. */
export function PUT(req: Request) {
  return handle(async () => {
    const uid = await requireUid(req);
    const body = await jsonBody(req);

    /* Three states, not two: key absent = leave the saved video untouched
       (e.g. a photo-only save from SiteBuilderWizard); explicit null = clear
       it; a string = set it, but only after confirming it's actually a video
       this uid uploaded — the id alone isn't proof of ownership, since it's
       not treated as secret (the signed URL is what protects reading it). */
    let verificationVideoId: string | null | undefined;
    if ("verificationVideoId" in body) {
      if (body.verificationVideoId === null) {
        verificationVideoId = null;
      } else {
        const id = str(body.verificationVideoId, "verificationVideoId", { max: 36, required: true });
        if (!(await ownsVideoFile(id, uid))) {
          throw new BadRequest("That video wasn't found on your account.");
        }
        verificationVideoId = id;
      }
    }

    await updateUserProfile(uid, {
      name: str(body.name, "name", { max: 255 }),
      phone: str(body.phone, "phone", { max: 64 }),
      company: str(body.company, "company", { max: 255 }),
      headline: str(body.headline, "headline", { max: 255 }),
      location: str(body.location, "location", { max: 255 }),
      linkedin: str(body.linkedin, "linkedin", { max: 512 }),
      website: str(body.website, "website", { max: 512 }),
      twitter: str(body.twitter, "twitter", { max: 512 }),
      facebook: str(body.facebook, "facebook", { max: 512 }),
      instagram: str(body.instagram, "instagram", { max: 512 }),
      bio: str(body.bio, "bio"),
      photoURL: str(body.photoURL, "photoURL", { max: 1024 }),
      verificationVideoId,
    });
    return ok(await getUserProfile(uid));
  });
}
