const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const workerDir = __dirname;

const {
	build_metadata_url,
	extract_tarball_url,
} = require('./pkg/worker_wasm.js');

async function fetchText(url) {
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`);
	}

	return res.text();
}

async function drainResponseBody(res) {
	if (!res.body) {
		await res.arrayBuffer();
		return;
	}

	const reader = res.body.getReader();
	try {
		while (true) {
			const { done } = await reader.read();
			if (done) break;
		}
	} finally {
		reader.releaseLock();
	}
}

async function download(url) {
	const res = await fetch(url, { redirect: 'follow' });

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`);
	}

	await drainResponseBody(res);
	console.log('done once')
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand({ name, count }) {
	const metadataUrl = build_metadata_url(name);
	const metadataJson = await fetchText(metadataUrl);
	const tarballUrl = extract_tarball_url(metadataJson);

	for (let i = 0; i < count; i++) {
		await download(tarballUrl);
		await sleep(1000);
	}

	console.log('Done');
}

async function main() {
	const commands = JSON.parse(
		readFileSync(join(workerDir, 'commands.json'), 'utf8')
	);

	await Promise.all(commands.map((command) => runCommand(command)));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
