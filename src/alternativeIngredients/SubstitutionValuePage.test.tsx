import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { MAX_LENGTHS } from '@/api/fieldLimits';
import {
	type RecommendationGrid,
	createAlternativeIngredient,
	discardAlternativeIngredient,
	fetchAlternativeIngredient,
	fetchRecommendationGrid,
	toggleRecommendation,
} from '@/alternativeIngredients/alternativeIngredients';
import { SubstitutionValuePage } from './SubstitutionValuePage';

vi.mock('@/alternativeIngredients/alternativeIngredients', () => ({
	fetchRecommendationGrid: vi.fn(),
	toggleRecommendation: vi.fn(),
	discardAlternativeIngredient: vi.fn(),
	createAlternativeIngredient: vi.fn(),
	fetchAlternativeIngredient: vi.fn(),
	editAlternativeIngredient: vi.fn(),
	revertAlternativeIngredient: vi.fn(),
	fetchAlternativeIngredientTranslations: vi.fn(),
	stageAlternativeIngredientTranslation: vi.fn(),
	revertAlternativeIngredientTranslation: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ReferenceEditDialog', () => ({
	ReferenceEditDialog: ({ title }: { title: string }) => <div role="dialog" aria-label={title} />,
}));
vi.mock('@/components/ReferenceTranslationsDialog', () => ({
	ReferenceTranslationsDialog: ({ title }: { title: string }) => <div role="dialog" aria-label={title} />,
}));

const fetchRecommendationGridMock = vi.mocked(fetchRecommendationGrid);
const toggleRecommendationMock = vi.mocked(toggleRecommendation);
const discardAlternativeIngredientMock = vi.mocked(discardAlternativeIngredient);
const createAlternativeIngredientMock = vi.mocked(createAlternativeIngredient);
const fetchAlternativeIngredientMock = vi.mocked(fetchAlternativeIngredient);

// Lentils: published, linked to legumes in master (a plain present cell), legumes absent for grains.
// Tofu: Working-Copy-only, a staged addition to whole grains (a green pending-add cell), discardable.
const gridFixture = (): RecommendationGrid => ({
	columns: [
		{ id: 'rec-legumes', componentForScoring: 'legumes', typeOfRecommendation: 'ENCOURAGED' },
		{ id: 'rec-processed-meat', componentForScoring: 'processed meat', typeOfRecommendation: 'LIMITED' },
		{ id: 'rec-grains', componentForScoring: 'whole grains', typeOfRecommendation: 'ENCOURAGED' },
	],
	ingredients: [
		{
			id: 'ai-lentils',
			name: 'Lentils',
			published: true,
			version: 0,
			translations: { EL: 'PRESENT', LT: 'MISSING', NL: 'MISSING' },
			linkedRecommendationIds: ['rec-legumes'],
			stagedRecommendationIds: [],
		},
		{
			id: 'ai-tofu',
			name: 'Tofu',
			published: false,
			version: 1,
			translations: { EL: 'MISSING', LT: 'MISSING', NL: 'MISSING' },
			linkedRecommendationIds: [],
			stagedRecommendationIds: ['rec-grains'],
		},
	],
});

describe('SubstitutionValuePage', () => {
	beforeEach(() => {
		fetchRecommendationGridMock.mockReset();
		toggleRecommendationMock.mockReset();
		discardAlternativeIngredientMock.mockReset();
		createAlternativeIngredientMock.mockReset();
		fetchAlternativeIngredientMock.mockReset();
		fetchRecommendationGridMock.mockResolvedValue(gridFixture());
	});

	it('renders a column per recommendation and a cell per ingredient reflecting its effective and pending state', async () => {
		render(<SubstitutionValuePage />);

		expect(await screen.findByText('+ legumes')).not.toBeNull();
		expect(screen.getByText('+ whole grains')).not.toBeNull();

		const lentilsLegumes = screen.getByLabelText('substitutionValue.toggleCell Lentils / legumes');
		expect(lentilsLegumes.getAttribute('aria-pressed')).toBe('true');
		const lentilsGrains = screen.getByLabelText('substitutionValue.toggleCell Lentils / whole grains');
		expect(lentilsGrains.getAttribute('aria-pressed')).toBe('false');

		const tofuGrains = screen.getByLabelText('substitutionValue.toggleCell Tofu / whole grains');
		expect(tofuGrains.getAttribute('aria-pressed')).toBe('true');
		expect(tofuGrains.className).toContain('bg-success');
		expect(tofuGrains.getAttribute('title')).toBe('Tofu: whole grains');

		expect(screen.getByText('substitutionValue.newBadge')).not.toBeNull();
	});

	it('marks the encouraged column headers with a plus and the limited ones with a minus', async () => {
		render(<SubstitutionValuePage />);

		const legumes = await screen.findByText('+ legumes');
		expect(legumes.getAttribute('title')).toBe('legumes: ENCOURAGED');
		const processedMeat = screen.getByText('- processed meat');
		expect(processedMeat.getAttribute('title')).toBe('processed meat: LIMITED');
	});

	it('offers a discard action only for a Working-Copy-only ingredient', async () => {
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		expect(screen.getByLabelText('substitutionValue.discardIngredient Tofu')).not.toBeNull();
		expect(screen.queryByLabelText('substitutionValue.discardIngredient Lentils')).toBeNull();
	});

	it('toggles an absent cell on and reloads', async () => {
		toggleRecommendationMock.mockResolvedValue(undefined);
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		fireEvent.click(screen.getByLabelText('substitutionValue.toggleCell Lentils / whole grains'));

		await waitFor(() => expect(toggleRecommendationMock).toHaveBeenCalledWith('ai-lentils', 'rec-grains', true));
		await waitFor(() => expect(fetchRecommendationGridMock).toHaveBeenCalledTimes(2));
	});

	it('toggles a present cell off', async () => {
		toggleRecommendationMock.mockResolvedValue(undefined);
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		fireEvent.click(screen.getByLabelText('substitutionValue.toggleCell Lentils / legumes'));

		await waitFor(() => expect(toggleRecommendationMock).toHaveBeenCalledWith('ai-lentils', 'rec-legumes', false));
	});

	it('stages a new alternative ingredient and clears the input', async () => {
		createAlternativeIngredientMock.mockResolvedValue({ id: 'ai-quinoa', name: 'Quinoa' });
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		const input = screen.getByLabelText('substitutionValue.addLabel') as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'Quinoa' } });
		fireEvent.click(screen.getByText('substitutionValue.add'));

		await waitFor(() => expect(createAlternativeIngredientMock).toHaveBeenCalledWith('Quinoa'));
		await waitFor(() => expect(input.value).toBe(''));
	});

	it('blocks adding and reports a new ingredient name longer than the backend accepts', async () => {
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		const input = screen.getByLabelText('substitutionValue.addLabel') as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'n'.repeat(MAX_LENGTHS.referenceName + 1) } });

		expect(screen.getByText('validation.tooLong')).not.toBeNull();
		expect((screen.getByText('substitutionValue.add') as HTMLButtonElement).disabled).toBe(true);
		expect(createAlternativeIngredientMock).not.toHaveBeenCalled();
		expect(input.className).toContain('border-error');
	});

	it('warns when the new name duplicates an existing one', async () => {
		createAlternativeIngredientMock.mockRejectedValue(new ApiError(409, 'duplicate'));
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		fireEvent.change(screen.getByLabelText('substitutionValue.addLabel'), { target: { value: 'Lentils' } });
		fireEvent.click(screen.getByText('substitutionValue.add'));

		expect(await screen.findByText('substitutionValue.duplicateName')).not.toBeNull();
	});

	it('shows a notice when a discard is refused because the ingredient is still referenced', async () => {
		discardAlternativeIngredientMock.mockRejectedValue(new ApiError(409, 'in use'));
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		fireEvent.click(screen.getByLabelText('substitutionValue.discardIngredient Tofu'));

		expect(await screen.findByText('substitutionValue.discardBlocked')).not.toBeNull();
	});

	it('opens the edit dialog after loading the ingredient details', async () => {
		fetchAlternativeIngredientMock.mockResolvedValue({
			name: 'Lentils',
			explanationForLlm: null,
			version: 0,
			published: true,
			referenceCount: 3,
		});
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		fireEvent.click(screen.getByLabelText('substitutionValue.editAlternativeIngredient Lentils'));

		await waitFor(() => expect(fetchAlternativeIngredientMock).toHaveBeenCalledWith('ai-lentils'));
		expect(
			await screen.findByRole('dialog', { name: 'substitutionValue.editAlternativeIngredient' }),
		).not.toBeNull();
	});

	it('opens the translations dialog from the chips', async () => {
		render(<SubstitutionValuePage />);
		await screen.findByText('+ legumes');

		fireEvent.click(screen.getByLabelText('substitutionValue.editTranslations Lentils'));

		expect(
			await screen.findByRole('dialog', { name: 'substitutionValue.editAlternativeTranslations' }),
		).not.toBeNull();
	});

	it('shows an error when the grid fails to load', async () => {
		fetchRecommendationGridMock.mockReset();
		fetchRecommendationGridMock.mockRejectedValue(new ApiError(500, 'boom'));
		render(<SubstitutionValuePage />);

		expect(await screen.findByText('substitutionValue.loadError')).not.toBeNull();
	});
});
