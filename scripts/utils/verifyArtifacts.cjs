const fs = require("fs");
const path = require("path");

function findBuildInfo(contractFile, contractName) {
	const biDir = path.join(process.cwd(), "artifacts", "build-info");
	const biFiles = fs.readdirSync(biDir).filter((f) => f.endsWith(".json"));
	const sorted = biFiles
		.map((f) => ({
			name: f,
			path: path.join(biDir, f),
			mtime: fs.statSync(path.join(biDir, f)).mtimeMs,
		}))
		.sort((a, b) => b.mtime - a.mtime);

	for (const f of sorted) {
		try {
			const data = JSON.parse(fs.readFileSync(f.path, "utf8"));
			const hasContract =
				data?.output?.contracts?.[contractFile]?.[contractName];
			if (hasContract && data?.input) return { file: f.name, path: f.path, data };
		} catch (_) {
			continue;
		}
	}

	for (const f of sorted) {
		try {
			const data = JSON.parse(fs.readFileSync(f.path, "utf8"));
			if (data?.input) return { file: f.name, path: f.path, data };
		} catch (_) {
			continue;
		}
	}
	return null;
}

function writeVerifyFiles({ scriptLabel, label, address, buildInfoData }) {
	const baseDir = path.join(process.cwd(), "deployments", "verify", scriptLabel);
	fs.mkdirSync(baseDir, { recursive: true });

	let buildInfoFile = "not-found";
	let standardJsonInputFile = "not-found";

	if (buildInfoData) {
		buildInfoFile = `${label}_buildinfo_${address}.json`;
		const biPath = path.join(baseDir, buildInfoFile);
		fs.writeFileSync(biPath, JSON.stringify(buildInfoData, null, 2));

		if (buildInfoData.input) {
			const stdInput = { ...buildInfoData.input };
			if (stdInput._format) delete stdInput._format;
			if (!stdInput.settings) stdInput.settings = {};
			if (!stdInput.settings.optimizer) {
				stdInput.settings.optimizer = { enabled: true, runs: 200 };
			}
			if (stdInput.settings.optimizer.enabled === false) {
				stdInput.settings.optimizer.enabled = true;
				stdInput.settings.optimizer.runs =
					stdInput.settings.optimizer.runs ?? 200;
			}
			stdInput.settings.evmVersion = stdInput.settings.evmVersion || "paris";

			standardJsonInputFile = `${label}_standard_json_${address}.json`;
			const stdPath = path.join(baseDir, standardJsonInputFile);
			fs.writeFileSync(stdPath, JSON.stringify(stdInput, null, 2));
		}
	}

	return { baseDir, buildInfoFile, standardJsonInputFile };
}

module.exports = { findBuildInfo, writeVerifyFiles };
