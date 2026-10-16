import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { MAX_LENGTHS } from '@/api/fieldLimits';
import { NewReferenceForm } from './NewReferenceForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function renderForm(onCreate: (name: string) => Promise<void>, onFailure = vi.fn()) {
	render(
		<NewReferenceForm
			label="New name"
			placeholder="New…"
			addText="Add"
			duplicateText="Already exists"
			onCreate={onCreate}
			onFailure={onFailure}
		/>,
	);
	return { input: screen.getByLabelText('New name') as HTMLInputElement, onFailure };
}

describe('NewReferenceForm', () => {
	it('creates the trimmed name and clears the input', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		const { input } = renderForm(onCreate);

		fireEvent.change(input, { target: { value: '  Feta  ' } });
		fireEvent.click(screen.getByText('Add'));

		await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Feta'));
		await waitFor(() => expect(input.value).toBe(''));
	});

	it('does not offer to add a blank name', () => {
		const onCreate = vi.fn();
		const { input } = renderForm(onCreate);

		fireEvent.change(input, { target: { value: '   ' } });

		expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(true);
	});

	it('blocks adding and reports a name longer than the backend accepts', () => {
		const onCreate = vi.fn();
		const { input } = renderForm(onCreate);

		fireEvent.change(input, { target: { value: 'n'.repeat(MAX_LENGTHS.referenceName + 1) } });

		expect(screen.getByText('validation.tooLong')).not.toBeNull();
		expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(true);
		expect(input.className).toContain('border-error');
		expect(onCreate).not.toHaveBeenCalled();
	});

	it('warns about a duplicate name and keeps it for correction', async () => {
		const { input, onFailure } = renderForm(vi.fn().mockRejectedValue(new ApiError(409, 'duplicate')));

		fireEvent.change(input, { target: { value: 'Feta' } });
		fireEvent.click(screen.getByText('Add'));

		expect(await screen.findByText('Already exists')).not.toBeNull();
		expect(input.value).toBe('Feta');
		expect(onFailure).not.toHaveBeenCalled();
	});

	it('reports any other failure to the caller', async () => {
		const { input, onFailure } = renderForm(vi.fn().mockRejectedValue(new ApiError(500, 'boom')));

		fireEvent.change(input, { target: { value: 'Feta' } });
		fireEvent.click(screen.getByText('Add'));

		await waitFor(() => expect(onFailure).toHaveBeenCalled());
		expect(screen.queryByText('Already exists')).toBeNull();
	});
});
