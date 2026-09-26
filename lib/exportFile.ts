import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function saveAndShare(filename: string, contents: string, mimeType: string) {
  const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!dir) throw new Error("No writable directory available on this device.");
  const path = dir + filename;
  await FileSystem.writeAsStringAsync(path, contents, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    // Rare (some emulators/configurations), but the caller needs to know — silently
    // "succeeding" here would look like the button did nothing when tapped.
    throw new Error("Sharing isn't available on this device. The file was saved, but couldn't be handed off.");
  }
  await Sharing.shareAsync(path, { mimeType, dialogTitle: `Export ${filename}` });
  return path;
}
