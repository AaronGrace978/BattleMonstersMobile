import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const repository=process.env.GITHUB_REPOSITORY||process.env.REPOSITORY;
if(!repository||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw Error('A valid GitHub repository is required');
const manifest=JSON.parse(await readFile('distribution/release/release-manifest.json','utf8'));
const tag=manifest.tag,sha=manifest.commit,draft=process.env.BMM_RELEASE_DRAFT==='true';
if(!/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(tag)||!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid release provenance');
function gh(args,allowFailure=false){const r=spawnSync('gh',args,{encoding:'utf8'});if(r.status&&!allowFailure)throw Error('GitHub release operation failed: '+(r.stderr||r.stdout).slice(0,2000));return r;}
const existing=gh(['release','view',tag,'--repo',repository,'--json','isDraft,assets'],true);
const old=existing.status===0?JSON.parse(existing.stdout):null;
if(old&&!old.isDraft)throw Error('This version is already published; bump the version instead of overwriting it');
let notes=await readFile('release/NOTES.md','utf8');
if(draft)notes=`**Draft — signing and publication pending.** Native builds compiled successfully from commit \`${sha}\`. The manifest records the actual signing state of each platform.\n\n`+notes;
const {writeFile}=await import('node:fs/promises');await writeFile('distribution/release-notes.md',notes);
const title=`Battle Monsters Mobile ${tag} — Android & iOS${draft?' (draft)':' development release'}`;
if(!old)gh(['release','create',tag,'--repo',repository,'--target',sha,'--title',title,'--notes-file','distribution/release-notes.md','--draft','--prerelease']);
for(const a of old?.assets||[]){if(a.name.startsWith(`BattleMonstersMobile-${tag}-`)||['android-build.json','ios-build.json','release-manifest.json','SHA256SUMS.txt'].includes(a.name))gh(['release','delete-asset',tag,a.name,'--repo',repository,'--yes']);}
const files=(await readdir('distribution/release')).map(n=>'distribution/release/'+n);
gh(['release','upload',tag,...files,'--repo',repository,'--clobber']);
gh(['release','edit',tag,'--repo',repository,'--target',sha,'--title',title,'--notes-file','distribution/release-notes.md',`--draft=${draft}`,'--prerelease']);
console.log(gh(['release','view',tag,'--repo',repository,'--json','url,isDraft,tagName']).stdout.trim());
