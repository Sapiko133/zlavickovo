export function normalizeShopSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(sk|cz|eu|com|net|org|hu|pl|ro|hr|si|bg|fi|se|de)$/i, "")
    .replace(/[áä]/g, "a").replace(/[čć]/g, "c").replace(/[ďđ]/g, "d")
    .replace(/[éě]/g, "e").replace(/[íî]/g, "i").replace(/[ľĺ]/g, "l")
    .replace(/[ňń]/g, "n").replace(/[óô]/g, "o").replace(/[řŕ]/g, "r")
    .replace(/[šś]/g, "s").replace(/[ťţ]/g, "t").replace(/[úůü]/g, "u")
    .replace(/[ýÿ]/g, "y").replace(/[žź]/g, "z")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
