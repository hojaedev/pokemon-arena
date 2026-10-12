export const PARTY_SIZE=6;
const idsOf=roster=>roster.map(item=>typeof item==='string'?item:item.id);
export function emptyDraft(){return Array(PARTY_SIZE).fill(null);}
export function normalizeDraft(ids,roster){
  const allowed=new Set(idsOf(roster)),seen=new Set();
  return Array.from({length:PARTY_SIZE},(_,i)=>{const id=Array.isArray(ids)?ids[i]:null;if(!allowed.has(id)||seen.has(id))return null;seen.add(id);return id;});
}
export function restoreDraft(saved,roster){
  // v3 saved default teams automatically. Only v4 explicitly chosen drafts qualify.
  return saved?.draftVersion===4&&saved?.intentionalDraft===true?normalizeDraft(saved.playerTeam,roster):emptyDraft();
}
export function selectionToSave(selection,previous,roster){
  // Fresh pages intentionally show an empty party. Changing a preference must not
  // erase the previous explicit draft before the player actually edits this one.
  if(selection.intentionalDraft)return {...selection,playerTeam:normalizeDraft(selection.playerTeam,roster),enemyTeam:normalizeDraft(selection.enemyTeam,roster)};
  return {...selection,draftVersion:4,intentionalDraft:previous?.draftVersion===4&&previous?.intentionalDraft===true,playerTeam:restoreDraft(previous,roster),enemyTeam:previous?.draftVersion===4?normalizeDraft(previous.enemyTeam,roster):emptyDraft()};
}
export function togglePick(draft,id,roster){
  const team=normalizeDraft(draft,roster),existing=team.indexOf(id);
  if(existing>=0){team[existing]=null;return {team,action:'remove',slot:existing};}
  if(!idsOf(roster).includes(id))return {team,action:'error',slot:-1};
  const slot=team.indexOf(null);if(slot<0)return {team,action:'full',slot:-1};
  team[slot]=id;return {team,action:'pick',slot};
}
export function isComplete(draft,roster){return normalizeDraft(draft,roster).every(Boolean);}
export function randomFill(draft,roster,random=Math.random){
  const team=normalizeDraft(draft,roster),pool=idsOf(roster).filter(id=>!team.includes(id));
  for(let i=pool.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return team.map(id=>id||pool.pop()||null);
}
export function generateCpuTeam(roster,random=Math.random){return randomFill(emptyDraft(),roster,random);}
