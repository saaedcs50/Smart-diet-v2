import { brandStorageSlug } from '../utils/storageKeys';

type OwnershipStore = Pick<Storage, 'getItem' | 'setItem'>;

export type LocalDataBindingStatus =
  | 'unbound'
  | 'matched'
  | 'mismatch'
  | 'unavailable';

interface LocalDataBinding {
  version: 1;
  patientUid: string;
  boundAt: string;
}

function bindingKey(): string {
  return `sd_${brandStorageSlug()}_platform_local_data_owner`;
}

function resolveStore(provided?: OwnershipStore): OwnershipStore | null {
  if (provided) return provided;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readBinding(store: OwnershipStore): LocalDataBinding | null {
  const raw = store.getItem(bindingKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalDataBinding>;
    if (
      parsed.version !== 1 ||
      typeof parsed.patientUid !== 'string' ||
      parsed.patientUid.length === 0 ||
      typeof parsed.boundAt !== 'string'
    ) {
      // A corrupted ownership marker must fail closed, never authorize upload.
      return {
        version: 1,
        patientUid: '__invalid_binding__',
        boundAt: '',
      };
    }
    return parsed as LocalDataBinding;
  } catch {
    return {
      version: 1,
      patientUid: '__invalid_binding__',
      boundAt: '',
    };
  }
}

/**
 * Device-local ownership lock for the legacy, brand-scoped local dataset.
 * It prevents a second signed-in patient from uploading the previous
 * patient's local records. It does not encrypt or fully namespace browser data.
 */
export function getLocalDataBindingStatus(
  patientUid: string,
  provided?: OwnershipStore,
): LocalDataBindingStatus {
  if (!patientUid) return 'mismatch';
  const store = resolveStore(provided);
  if (!store) return 'unavailable';
  try {
    const binding = readBinding(store);
    if (!binding) return 'unbound';
    return binding.patientUid === patientUid ? 'matched' : 'mismatch';
  } catch {
    return 'unavailable';
  }
}

/** True when the legacy device dataset is already associated with any patient account. */
export function hasLegacyLocalDataBinding(
  provided?: OwnershipStore,
): boolean {
  const store = resolveStore(provided);
  if (!store) return true; // fail closed: unknown ownership is treated as bound
  try {
    return readBinding(store) !== null;
  } catch {
    return true;
  }
}

/**
 * Binds the current local dataset to one patient after explicit user
 * confirmation in the UI. The binding is immutable from the app; a different
 * account must use a separate browser profile/device or reset local data.
 */
export function bindLocalDataToPatient(
  patientUid: string,
  provided?: OwnershipStore,
  now: Date = new Date(),
): void {
  if (!patientUid) throw new Error('لا يمكن ربط بيانات الجهاز بمعرّف حساب فارغ');
  const store = resolveStore(provided);
  if (!store) throw new Error('التخزين المحلي غير متاح؛ تعذّر التحقق من ملكية البيانات');

  const current = readBinding(store);
  if (current && current.patientUid !== patientUid) {
    throw new Error('بيانات هذا الجهاز مرتبطة بحساب آخر؛ تم منع المزامنة لحماية الخصوصية');
  }
  if (current) return;

  store.setItem(
    bindingKey(),
    JSON.stringify({
      version: 1,
      patientUid,
      boundAt: now.toISOString(),
    } satisfies LocalDataBinding),
  );
}
