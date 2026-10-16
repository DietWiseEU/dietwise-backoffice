import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireBackofficeRole } from '@/auth/RequireBackofficeRole';
import { AppLayout } from '@/layout/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RecommendationsPage } from '@/recommendations/RecommendationsPage';
import { RulesPage } from '@/rules/RulesPage';
import { SeasonalityCostPage } from '@/seasonalityCost/SeasonalityCostPage';
import { SubstitutionValuePage } from '@/alternativeIngredients/SubstitutionValuePage';
import { TriggerIngredientComponentsPage } from '@/triggerIngredients/TriggerIngredientComponentsPage';

export const router = createBrowserRouter(
	[
		{
			path: '/',
			element: (
				<RequireAuth>
					<AppLayout />
				</RequireAuth>
			),
			children: [
				{ index: true, element: <HomePage /> },
				{
					path: 'rules',
					element: (
						<RequireBackofficeRole>
							<RulesPage />
						</RequireBackofficeRole>
					),
				},
				{
					path: 'recommendations',
					element: (
						<RequireBackofficeRole>
							<RecommendationsPage />
						</RequireBackofficeRole>
					),
				},
				{
					path: 'substitution-value',
					element: (
						<RequireBackofficeRole>
							<SubstitutionValuePage />
						</RequireBackofficeRole>
					),
				},
				{
					path: 'trigger-ingredient-components',
					element: (
						<RequireBackofficeRole>
							<TriggerIngredientComponentsPage />
						</RequireBackofficeRole>
					),
				},
				{
					path: 'seasonality-cost',
					element: (
						<RequireBackofficeRole>
							<SeasonalityCostPage />
						</RequireBackofficeRole>
					),
				},
				// Entity CRUD routes get added here.
			],
		},
		{ path: '*', element: <NotFoundPage /> },
	],
	{ basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
