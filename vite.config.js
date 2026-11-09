import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {rm} from 'node:fs/promises';
export default defineConfig(({mode})=>({plugins:[react(),...(mode==='mobile'?[{name:'exclude-development-downloads',async closeBundle(){await rm('web/downloads',{recursive:true,force:true});await rm('web/handoff',{recursive:true,force:true});}}]:[])],build:{outDir:'web',sourcemap:false},server:{allowedHosts:true}}));
