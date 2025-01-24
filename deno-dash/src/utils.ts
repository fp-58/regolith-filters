export async function readJsonFile(path: string) {
  return JSON.parse(await Deno.readTextFile(path));
}
