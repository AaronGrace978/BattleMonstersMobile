import {readFileSync} from 'node:fs';
const {version}=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url)));
if(!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))throw new Error('Invalid release version');
console.log(`version=${version}\ntag=v${version}`);
