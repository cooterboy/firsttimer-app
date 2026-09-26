import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function saveAndShare(filename: string, contents: string, mimeType: string) {
  const path = (FileSystem.documentDirectory || FileSystem.cacheDirectory) + filename;
  await FileSystem.writeAsStringAsync(path, contents, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, { mimeType, dialogTitle: `Export ${filename}` });
  }
  return path;
}
