/**
 * systems/contentValidation.ts — typed development checks for content data.
 *
 * These helpers inspect the live engine registries without changing save data,
 * prices, unlocks, or CpS rules. They make content mistakes visible while new
 * buildings and upgrades are being added, and provide a compact economy
 * snapshot for balancing work.
 */
import type {
	Building,
	ContentValidationIssue,
	ContentValidationReport,
	EconomyBuildingReport,
	EconomyReport,
	EconomySimulationPoint,
	EconomyAnalysisOptions,
	EconomyMilestoneReport,
	EconomyUpgradeReport,
	FullEconomyReport,
	Game,
	Upgrade,
} from '../types';

function issue(
	severity: ContentValidationIssue['severity'],
	code: string,
	message: string,
	item?: string,
): ContentValidationIssue {
	return { severity, code, message, item };
}

function effectiveStoreOrder(building: Building): number {
	return typeof building.storeOrder === 'number' ? building.storeOrder : building.id;
}

function validateIcon(upgrade: Upgrade, issues: ContentValidationIssue[]): void {
	if (!Array.isArray(upgrade.icon)) return;
	if (upgrade.icon.length < 2 || typeof upgrade.icon[0] !== 'number' || typeof upgrade.icon[1] !== 'number') {
		issues.push(issue('error', 'invalid-icon', 'Upgrade icon must contain numeric column and row coordinates.', upgrade.name));
		return;
	}
	if (upgrade.icon.length >= 3 && typeof upgrade.icon[2] !== 'string') {
		issues.push(issue('error', 'invalid-icon-source', 'Custom upgrade icon source must be a sprite path string.', upgrade.name));
	}
}

/** Validate registered building, upgrade, tier, and store relationships. */
export function ValidateContent(game: Game): ContentValidationReport {
	const issues: ContentValidationIssue[] = [];
	const buildings = Object.values(game.Objects) as Building[];
	const upgrades = Object.values(game.Upgrades) as Upgrade[];
	const buildingIds = new Map<number, string>();
	const upgradeIds = new Map<number, string>();
	const storeOrders = new Map<number, string>();

	for (const building of buildings) {
		if (buildingIds.has(building.id)) {
			issues.push(issue('error', 'duplicate-building-id', `Building id ${building.id} is already used by ${buildingIds.get(building.id)}.`, building.name));
		} else {
			buildingIds.set(building.id, building.name);
		}
		if (game.ObjectsById[building.id] !== building) {
			issues.push(issue('error', 'building-index-mismatch', 'Building is not reachable at ObjectsById[id].', building.name));
		}
		if (game.Objects[building.name] !== building) {
			issues.push(issue('error', 'building-registry-mismatch', 'Building name map does not point to the registered instance.', building.name));
		}
		const order = effectiveStoreOrder(building);
		if (storeOrders.has(order)) {
			issues.push(issue('error', 'duplicate-store-order', `Store order ${order} is already used by ${storeOrders.get(order)}.`, building.name));
		} else {
			storeOrders.set(order, building.name);
		}
		for (const tierKey of Object.keys(building.tieredUpgrades || {})) {
			const upgrade = building.tieredUpgrades[tierKey];
			if (!game.Tiers[tierKey]) {
				issues.push(issue('error', 'missing-tier', `Tier ${tierKey} is not defined in Game.Tiers.`, `${building.name}:${tierKey}`));
			}
			if (upgrade && upgrade.buildingTie !== building) {
				issues.push(issue('error', 'tier-building-mismatch', 'Tiered upgrade is registered to a different building.', upgrade.name));
			}
		}
		for (const tierKey of Object.keys(building.tieredAchievs || {})) {
			const achievement = building.tieredAchievs[tierKey];
			if (!game.Tiers[tierKey]) {
				issues.push(issue('error', 'missing-achievement-tier', `Achievement tier ${tierKey} is not defined in Game.Tiers.`, `${building.name}:${tierKey}`));
			}
			if (achievement && achievement.buildingTie !== building) {
				issues.push(issue('error', 'achievement-building-mismatch', 'Tiered achievement is registered to a different building.', achievement.name));
			}
		}
	}

	for (const upgrade of upgrades) {
		if (upgradeIds.has(upgrade.id)) {
			issues.push(issue('error', 'duplicate-upgrade-id', `Upgrade id ${upgrade.id} is already used by ${upgradeIds.get(upgrade.id)}.`, upgrade.name));
		} else {
			upgradeIds.set(upgrade.id, upgrade.name);
		}
		if (game.UpgradesById[upgrade.id] !== upgrade) {
			issues.push(issue('error', 'upgrade-index-mismatch', 'Upgrade is not reachable at UpgradesById[id].', upgrade.name));
		}
		validateIcon(upgrade, issues);
		if (upgrade.buildingTie && typeof upgrade.buildingTie !== 'number' && upgrade.tier && !game.Tiers[upgrade.tier]) {
			issues.push(issue('error', 'upgrade-missing-tier', `Upgrade references undefined tier ${upgrade.tier}.`, upgrade.name));
		}
	}

	for (const [tierKey, tier] of Object.entries(game.Tiers)) {
		if (!Number.isFinite(tier.unlock)) {
			issues.push(issue('error', 'invalid-tier-unlock', 'Tier unlock must be a finite number.', tierKey));
		}
	}

	const errors = issues.filter((entry) => entry.severity === 'error').length;
	return {
		valid: errors === 0,
		errors,
		warnings: issues.filter((entry) => entry.severity === 'warning').length,
		buildingCount: buildings.length,
		upgradeCount: upgrades.length,
		issues,
	};
}

function snapshotBuildings(game: Game): EconomyBuildingReport[] {
	return (Object.values(game.Objects) as Building[])
		.sort((a, b) => effectiveStoreOrder(a) - effectiveStoreOrder(b))
		.map((building): EconomyBuildingReport => ({
			name: building.name,
			storeOrder: effectiveStoreOrder(building),
			amount: building.amount,
			baseCps: typeof building.baseCps === 'number' ? building.baseCps : 0,
			cpsPerBuilding: building.storedCps,
			totalCps: building.storedTotalCps,
			share: game.cookiesPs > 0 ? building.storedTotalCps / game.cookiesPs : 0,
			nextPurchaseCost: 0,
			marginalCps: 0,
			paybackSeconds: Infinity,
		}));
}

/** Recalculate and return the current production snapshot for balancing. */
export function GetEconomyReport(game: Game): EconomyReport {
	game.CalculateGains();
	const buildings = snapshotBuildings(game);
	for (const report of buildings) {
		const building = game.Objects[report.name];
		report.nextPurchaseCost = building.getPrice();
		const originalAmount = building.amount;
		const originalTotalCps = building.storedTotalCps;
		building.amount = originalAmount + 1;
		game.CalculateGains();
		report.marginalCps = Math.max(0, building.storedTotalCps - originalTotalCps);
		building.amount = originalAmount;
		game.CalculateGains();
		report.paybackSeconds = report.marginalCps > 0 ? report.nextPurchaseCost / report.marginalCps : Infinity;
	}
	return {
		totalCps: game.cookiesPs,
		buildings,
	};
}

function withEconomySandbox<T>(game: Game, callback: (buildings: Building[], upgrades: Upgrade[]) => T): T {
	const buildings = Object.values(game.Objects) as Building[];
	const upgrades = Object.values(game.Upgrades) as Upgrade[];
	const originalBuildings = new Map(buildings.map((building) => [building.name, {
		amount: building.amount,
		bought: building.bought,
		unlocked: building.unlocked,
	}]));
	const originalUpgrades = new Map(upgrades.map((upgrade) => [upgrade.name, {
		bought: upgrade.bought,
		unlocked: upgrade.unlocked,
	}]));
	const originalState = {
		cookies: game.cookies,
		cookiesEarned: game.cookiesEarned,
		buildingsOwned: game.BuildingsOwned,
		upgradesOwned: game.UpgradesOwned,
	};
	try {
		return callback(buildings, upgrades);
	} finally {
		for (const building of buildings) {
			const state = originalBuildings.get(building.name);
			if (!state) continue;
			building.amount = state.amount;
			building.bought = state.bought;
			building.unlocked = state.unlocked;
		}
		for (const upgrade of upgrades) {
			const state = originalUpgrades.get(upgrade.name);
			if (!state) continue;
			upgrade.bought = state.bought;
			upgrade.unlocked = state.unlocked;
		}
		game.cookies = originalState.cookies;
		game.cookiesEarned = originalState.cookiesEarned;
		game.BuildingsOwned = originalState.buildingsOwned;
		game.UpgradesOwned = originalState.upgradesOwned;
		game.recalculateGains = 1;
		game.CalculateGains();
	}
}

function buildingNamesForUpgrade(upgrade: Upgrade): string[] {
	const names: string[] = [];
	for (const tie of [upgrade.buildingTie, upgrade.buildingTie1, upgrade.buildingTie2]) {
		if (tie && typeof tie === 'object' && typeof tie.name === 'string' && !names.includes(tie.name)) names.push(tie.name);
	}
	return names;
}

function upgradeReport(game: Game, upgrade: Upgrade): EconomyUpgradeReport {
	game.CalculateGains();
	const baselineCps = game.cookiesPs;
	const baselineClickCps = Number(game.computedMouseCps || 0);
	const bought = upgrade.bought > 0;
	let ownedCps = 0;
	let purchaseCps = 0;
	let ownedClickCps = 0;
	let purchaseClickCps = 0;

	if (bought) {
		upgrade.bought = 0;
		game.CalculateGains();
		ownedCps = Math.max(0, baselineCps - game.cookiesPs);
		ownedClickCps = Math.max(0, baselineClickCps - Number(game.computedMouseCps || 0));
		upgrade.bought = 1;
	} else {
		upgrade.bought = 1;
		game.CalculateGains();
		purchaseCps = Math.max(0, game.cookiesPs - baselineCps);
		purchaseClickCps = Math.max(0, Number(game.computedMouseCps || 0) - baselineClickCps);
		upgrade.bought = 0;
	}
	game.CalculateGains();

	const currentPrice = upgrade.getPrice();
	return {
		name: upgrade.name,
		id: upgrade.id,
		pool: upgrade.pool,
		buildingNames: buildingNamesForUpgrade(upgrade),
		basePrice: upgrade.basePrice,
		currentPrice,
		bought,
		unlocked: upgrade.unlocked > 0,
		ownedCps,
		purchaseCps,
		ownedClickCps,
		purchaseClickCps,
		paybackSeconds: purchaseCps > 0 ? currentPrice / purchaseCps : Infinity,
	};
}

function scenarioAmounts(buildings: Building[], requested: Record<string, number>): Record<string, number> {
	const amounts: Record<string, number> = {};
	for (const building of buildings) {
		const requestedAmount = requested[building.name];
		const amount = Number.isFinite(requestedAmount) ? Math.max(0, Math.floor(requestedAmount)) : 0;
		building.amount = amount;
		if (amount > 0) amounts[building.name] = amount;
	}
	return amounts;
}

function runMilestone(game: Game, buildings: Building[], label: string, requested: Record<string, number>, upgrades?: string[]): EconomyMilestoneReport {
	for (const upgrade of Object.values(game.Upgrades) as Upgrade[]) upgrade.bought = 0;
	for (const name of upgrades || []) {
		if (game.Upgrades[name]) game.Upgrades[name].bought = 1;
	}
	const amounts = scenarioAmounts(buildings, requested);
	let totalInvestment = 0;
	for (const building of buildings) {
		const targetAmount = building.amount;
		building.amount = 0;
		totalInvestment += building.getSumPrice(targetAmount);
		building.amount = targetAmount;
	}
	game.CalculateGains();
	const report = snapshotBuildings(game);
	const leaders = [...report].sort((a, b) => b.totalCps - a.totalCps).filter((building) => building.totalCps > 0).slice(0, 3).map((building) => building.name);
	return {
		label,
		buildingAmounts: amounts,
		totalInvestment,
		totalCps: game.cookiesPs,
		clickCps: Number(game.computedMouseCps || 0),
		leadingBuildings: leaders,
	};
}

/** Analyze every registered building and upgrade, plus controlled progression milestones. */
export function AnalyzeEconomy(game: Game, options: EconomyAnalysisOptions = {}): FullEconomyReport {
	return withEconomySandbox(game, (buildings, upgrades) => {
		game.CalculateGains();
		const baselineCps = game.cookiesPs;
		const baselineClickCps = Number(game.computedMouseCps || 0);
		const buildingReport = GetEconomyReport(game).buildings;
		const upgradeReports = upgrades.map((upgrade) => upgradeReport(game, upgrade));
		const milestones: EconomyMilestoneReport[] = [];
		if (options.scenarios && options.scenarios.length > 0) {
			for (const scenario of options.scenarios) milestones.push(runMilestone(game, buildings, scenario.label, scenario.buildings, scenario.upgrades));
		} else {
			const levels = [...new Set((options.levels || [1, 10, 25, 50, 100, 250, 500]).filter((level) => Number.isFinite(level) && level > 0).map((level) => Math.floor(level)))];
			for (const building of buildings) {
				for (const level of levels) milestones.push(runMilestone(game, buildings, `${building.name} x${level}`, { [building.name]: level }));
			}
		}
		return {
			buildingCount: buildings.length,
			upgradeCount: upgrades.length,
			baselineCps,
			baselineClickCps,
			buildings: buildingReport,
			upgrades: upgradeReports,
			milestones,
		};
	});
}

/** Run several named-building scenarios and restore the complete live economy state. */
export function SimulateEconomy(game: Game, scenarios: Record<string, number>[]): EconomySimulationPoint[] {
	return withEconomySandbox(game, (buildings) => scenarios.map((scenario) => {
		scenarioAmounts(buildings, scenario);
		game.CalculateGains();
		const report = GetEconomyReport(game);
		return { amounts: { ...scenario }, totalCps: report.totalCps, buildings: report.buildings };
	}));
}
