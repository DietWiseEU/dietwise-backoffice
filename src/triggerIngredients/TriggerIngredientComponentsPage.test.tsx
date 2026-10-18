import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { createTriggerIngredient } from '@/rules/rules';
import {
	type TriggerIngredientGrid,
	fetchTriggerIngredientGrid,
	toggleTriggerIngredientRecommendation,
} from '@/triggerIngredients/triggerIngredients';
import { TriggerIngredientComponentsPage } from './TriggerIngredientComponentsPage';

vi.mock('@/triggerIngredients/triggerIngredients', () => ({
	fetchTriggerIngredientGrid: vi.fn(),
	toggleTriggerIngredientRecommendation: vi.fn(),
}));
vi.mock('@/rules/rules', () => ({
	createTriggerIngredient: vi.fn(),
	fetchTriggerIngredient: vi.fn(),
	editTriggerIngredient: vi.fn(),
	revertTriggerIngredient: vi.fn(),
	fetchTriggerIngredientTranslations: vi.fn(),
	stageTriggerIngredientTranslation: vi.fn(),
	revertTriggerIngredientTranslation: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ReferenceEditDialog', () => ({
	ReferenceEditDialog: ({ title }: { title: string }) => <div role="dialog" aria-label={title} />,
}));
vi.mock('@/components/ReferenceTranslationsDialog', () => ({
	ReferenceTranslationsDialog: ({ title }: { title: string }) => <div role="dialog" aria-label={title} />,
}));

const fetchTriggerIngredientGridMock = vi.mocked(fetchTriggerIngredientGrid);
const toggleMock = vi.mocked(toggleTriggerIngredientRecommendation);
const createTriggerIngredientMock = vi.mocked(createTriggerIngredient);

// Beef: published, its Rule assigns red meat (a locked cell), also linked to sodium in master.
// Feta: Working-Copy-only and without Rules (scoring only), a staged addition of sodium.
const gridFixture = (): TriggerIngredientGrid => ({
	columns: [
		{ id: 'rec-vegetables', componentForScoring: 'vegetables', typeOfRecommendation: 'ENCOURAGED' },
		{ id: 'rec-red-meat', componentForScoring: 'red meat', typeOfRecommendation: 'LIMITED' },
		{ id: 'rec-sodium', componentForScoring: 'sodium', typeOfRecommendation: 'LIMITED' },
	],
	triggerIngredients: [
		{
			id: 'ti-beef',
			name: 'Beef',
			published: true,
			version: 0,
			translations: { EL: 'PRESENT', LT: 'MISSING', NL: 'MISSING' },
			linkedRecommendationIds: ['rec-red-meat', 'rec-sodium'],
			stagedRecommendationIds: [],
			ruleRecommendationIds: ['rec-red-meat'],
		},
		{
			id: 'ti-feta',
			name: 'Feta',
			published: false,
			version: 1,
			translations: { EL: 'MISSING', LT: 'MISSING', NL: 'MISSING' },
			linkedRecommendationIds: [],
			stagedRecommendationIds: ['rec-sodium'],
			ruleRecommendationIds: [],
		},
	],
});

describe('TriggerIngredientComponentsPage', () => {
	beforeEach(() => {
		fetchTriggerIngredientGridMock.mockReset();
		toggleMock.mockReset();
		createTriggerIngredientMock.mockReset();
		fetchTriggerIngredientGridMock.mockResolvedValue(gridFixture());
	});

	it('renders a cell per trigger ingredient and component, locking the components assigned by a rule', async () => {
		render(<TriggerIngredientComponentsPage />);

		expect(await screen.findByText('vegetables')).not.toBeNull();
		const beefRedMeat = screen.getByLabelText('triggerIngredients.toggleCell Beef / red meat') as HTMLButtonElement;
		expect(beefRedMeat.getAttribute('aria-pressed')).toBe('true');
		expect(beefRedMeat.disabled).toBe(true);
		expect(beefRedMeat.getAttribute('title')).toBe('Beef: red meat (triggerIngredients.lockedByRule)');
		const beefSodium = screen.getByLabelText('triggerIngredients.toggleCell Beef / sodium') as HTMLButtonElement;
		expect(beefSodium.getAttribute('aria-pressed')).toBe('true');
		expect(beefSodium.disabled).toBe(false);
		const fetaSodium = screen.getByLabelText('triggerIngredients.toggleCell Feta / sodium');
		expect(fetaSodium.className).toContain('bg-success');
	});

	it('badges a new trigger ingredient and one without rules', async () => {
		render(<TriggerIngredientComponentsPage />);
		await screen.findByText('vegetables');

		expect(screen.getByText('triggerIngredients.newBadge')).not.toBeNull();
		expect(screen.getAllByText('triggerIngredients.scoringOnlyBadge')).toHaveLength(1);
	});

	it('toggles a cell to the opposite presence and reloads', async () => {
		toggleMock.mockResolvedValue(undefined);
		render(<TriggerIngredientComponentsPage />);
		await screen.findByText('vegetables');

		fireEvent.click(screen.getByLabelText('triggerIngredients.toggleCell Beef / sodium'));

		await waitFor(() => expect(toggleMock).toHaveBeenCalledWith('ti-beef', 'rec-sodium', false));
		await waitFor(() => expect(fetchTriggerIngredientGridMock).toHaveBeenCalledTimes(2));
	});

	it('warns and reloads when the server refuses a toggle', async () => {
		toggleMock.mockRejectedValue(new ApiError(409, 'assigned by a rule'));
		render(<TriggerIngredientComponentsPage />);
		await screen.findByText('vegetables');

		fireEvent.click(screen.getByLabelText('triggerIngredients.toggleCell Beef / sodium'));

		expect(await screen.findByText('triggerIngredients.staleReload')).not.toBeNull();
		await waitFor(() => expect(fetchTriggerIngredientGridMock).toHaveBeenCalledTimes(2));
	});

	it('stages a new trigger ingredient and reloads', async () => {
		createTriggerIngredientMock.mockResolvedValue({ id: 'ti-halloumi', name: 'Halloumi' });
		render(<TriggerIngredientComponentsPage />);
		await screen.findByText('vegetables');

		fireEvent.change(screen.getByLabelText('triggerIngredients.addLabel'), { target: { value: 'Halloumi' } });
		fireEvent.click(screen.getByText('triggerIngredients.add'));

		await waitFor(() => expect(createTriggerIngredientMock).toHaveBeenCalledWith('Halloumi'));
		await waitFor(() => expect(fetchTriggerIngredientGridMock).toHaveBeenCalledTimes(2));
	});

	it('opens the edit dialog from the name', async () => {
		render(<TriggerIngredientComponentsPage />);
		await screen.findByText('vegetables');

		fireEvent.click(screen.getByLabelText('triggerIngredients.editTriggerIngredient Beef'));

		expect(await screen.findByRole('dialog', { name: 'triggerIngredients.editTriggerIngredient' })).not.toBeNull();
	});

	it('opens the translations dialog from the chips', async () => {
		render(<TriggerIngredientComponentsPage />);
		await screen.findByText('vegetables');

		fireEvent.click(screen.getByLabelText('triggerIngredients.editTranslations Beef'));

		expect(
			await screen.findByRole('dialog', { name: 'triggerIngredients.editTriggerTranslations' }),
		).not.toBeNull();
	});

	it('shows an error when the grid fails to load', async () => {
		fetchTriggerIngredientGridMock.mockReset();
		fetchTriggerIngredientGridMock.mockRejectedValue(new ApiError(500, 'boom'));
		render(<TriggerIngredientComponentsPage />);

		expect(await screen.findByText('triggerIngredients.loadError')).not.toBeNull();
	});
});
