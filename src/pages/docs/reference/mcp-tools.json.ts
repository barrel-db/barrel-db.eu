// The server's tools/list answer, as captured in src/data/mcp-tools.json.
import type { APIRoute } from 'astro';
import data from '../../../data/mcp-tools.json';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(data, null, 1) + '\n', {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
