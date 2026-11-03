import { betaAccessAllowed, BETA_ACCESS_MESSAGE, validBetaPolicy, betaPolicyRequired } from '../beta-access.mjs';

export class BetaAccessError extends Error {
  constructor() { super(BETA_ACCESS_MESSAGE); this.status = 403; }
}
const get = (reader, ref) => typeof reader.get === 'function' ? reader.get(ref) : ref.get();
export const accountUid = person => typeof person === 'string' ? person : person.uid;

// Run inside each mutation transaction, including checks of counterparties.
// Membership is tied to a Firebase UID, never an editable profile/email claim.
export async function assertBetaMembers(db, reader, ...people) {
  const snapshot = await get(reader, db.doc('betaSettings/access'));
  if (!snapshot.exists) {
    if (betaPolicyRequired(db.projectId)) throw new BetaAccessError();
    return;
  }
  const policy = snapshot.data();
  if (!validBetaPolicy(policy)) throw new BetaAccessError();
  const members = await Promise.all(people.map(person => get(reader, db.doc(`betaAccess/${accountUid(person)}`))));
  for (let i = 0; i < people.length; i++) {
    const campus = typeof people[i] === 'string' ? policy.campusId : people[i].campusId;
    if (!betaAccessAllowed(policy, members[i].data(), campus, db.projectId)) throw new BetaAccessError();
  }
}
