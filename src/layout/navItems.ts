import type { ComponentType } from 'react';
import { FiAward, FiCalendar, FiGrid, FiHome, FiList, FiTarget } from 'react-icons/fi';

export interface NavItem {
	to: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	/** Match the route exactly (used for the index route). */
	end?: boolean;
}

// Entity CRUD routes get appended here as the backoffice grows.
export const navItems: NavItem[] = [
	{ to: '/', labelKey: 'nav.home', icon: FiHome, end: true },
	{ to: '/rules', labelKey: 'nav.rules', icon: FiList },
	{ to: '/recommendations', labelKey: 'nav.recommendations', icon: FiAward },
	{ to: '/substitution-value', labelKey: 'nav.substitutionValue', icon: FiGrid },
	{ to: '/trigger-ingredient-components', labelKey: 'nav.triggerIngredientComponents', icon: FiTarget },
	{ to: '/seasonality-cost', labelKey: 'nav.seasonalityCost', icon: FiCalendar },
];
