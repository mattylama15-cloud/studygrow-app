// Take/pick a photo and turn it into a small base64 data URL. The old `usePhotoScan`
// hook was removed because it used `Alert.alert` which doesn't work on web — screens
// now use their own modal chooser and call `pickImageDataUrl` + `extractTextFromImage`.
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { AIError, getAiLang } from './client';
import { translate } from '../i18n';

// Zkratka: hláška pro uživatele ve zvoleném jazyce.
const tr = (key: string) => translate(getAiLang(), key);

// Pick (camera or library), resize + compress, return a "data:image/jpeg;base64,..." URL.
export async function pickImageDataUrl(useCamera: boolean): Promise<string | null> {
  if (useCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new AIError(tr('ai.err.noCameraPerm'));
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new AIError(tr('ai.err.noPhotosPerm'));
  }

  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });

  if (result.canceled || !result.assets?.length) return null;

  // 1600 px / 80 % — při 1100 px a 0.6 se drobné rukopisné písmo rozmazalo
  // a model půlku stránky nepřečetl. Větší soubor se pořád v pohodě odešle.
  const manip = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 1600 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!manip.base64) throw new AIError(tr('ai.err.photoProcess'));
  return `data:image/jpeg;base64,${manip.base64}`;
}

// Pick up to 10 images at once. Camera = single shot; library = multi-select.
export async function pickImages(useCamera: boolean): Promise<string[]> {
  if (useCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new AIError(tr('ai.err.noCameraPerm'));
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new AIError(tr('ai.err.noPhotosPerm'));
  }
  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsMultipleSelection: true, selectionLimit: 10 });
  if (result.canceled || !result.assets?.length) return [];
  const urls: string[] = [];
  for (const asset of result.assets.slice(0, 10)) {
    const manip = await manipulateAsync(asset.uri, [{ resize: { width: 820 } }], {
      compress: 0.45,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (manip.base64) urls.push(`data:image/jpeg;base64,${manip.base64}`);
  }
  return urls;
}
