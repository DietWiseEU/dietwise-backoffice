import { useState } from 'react';
import { ApiError } from '@/api/client';
import { isTooLong, MAX_LENGTHS } from '@/api/fieldLimits';
import { TooLongError } from '@/components/TooLongError';

interface NewReferenceFormProps {
	label: string;
	placeholder: string;
	addText: string;
	/** Shown when the server refuses the name (409) because another entry already uses it. */
	duplicateText: string;
	/** Stages the new entry; rejects with {@link ApiError} status 409 when the name is taken. */
	onCreate: (name: string) => Promise<void>;
	/** Called when staging fails for any reason other than a taken name. */
	onFailure: () => void;
}

/**
 * Stages a brand-new shared reference entity (e.g. an Alternative or Trigger Ingredient) by English name. Refuses a
 * blank name or one longer than the backend accepts, and keeps a taken name in the input for correction.
 */
export function NewReferenceForm({
	label,
	placeholder,
	addText,
	duplicateText,
	onCreate,
	onFailure,
}: NewReferenceFormProps) {
	const [name, setName] = useState('');
	const [duplicate, setDuplicate] = useState(false);
	const [creating, setCreating] = useState(false);
	const tooLong = isTooLong(name, MAX_LENGTHS.referenceName);

	const create = async () => {
		const trimmed = name.trim();
		if (trimmed === '' || creating) {
			return;
		}
		setCreating(true);
		try {
			await onCreate(trimmed);
			setName('');
			setDuplicate(false);
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				setDuplicate(true);
			} else {
				onFailure();
			}
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="mt-4 flex flex-wrap items-center gap-2">
			<input
				type="text"
				className={`input-bordered input input-sm ${tooLong ? 'border-error' : ''}`}
				aria-label={label}
				placeholder={placeholder}
				value={name}
				onChange={(event) => {
					setName(event.target.value);
					setDuplicate(false);
				}}
			/>
			<button
				type="button"
				className="btn btn-primary btn-sm"
				disabled={name.trim() === '' || tooLong || creating}
				onClick={create}
			>
				{addText}
			</button>
			<TooLongError value={name} max={MAX_LENGTHS.referenceName} />
			{duplicate ? <span className="text-sm text-error">{duplicateText}</span> : null}
		</div>
	);
}
