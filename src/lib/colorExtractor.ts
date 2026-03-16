/**
 * Color Extractor - Extracts dominant colors from an image file
 * 
 * Uses Canvas API to analyze pixel data and find the 2 most dominant colors.
 * Filters out whites, blacks, and very desaturated colors.
 */

interface RGB {
    r: number;
    g: number;
    b: number;
}

interface ExtractedColors {
    primary: string;   // hex
    secondary: string; // hex
    palette: string[]; // top 5 colors as hex
}

/**
 * Extracts dominant colors from an image file.
 * Returns primary and secondary colors as hex strings.
 */
export async function extractDominantColors(file: File): Promise<ExtractedColors> {
    const imageBitmap = await createImageBitmap(file);

    // Scale down for faster processing (max 100x100)
    const maxSize = 100;
    const scale = Math.min(maxSize / imageBitmap.width, maxSize / imageBitmap.height, 1);
    const width = Math.round(imageBitmap.width * scale);
    const height = Math.round(imageBitmap.height * scale);

    // Draw to canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Collect colors (skip transparent pixels)
    const colors: RGB[] = [];
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip transparent or near-transparent pixels
        if (a < 128) continue;

        // Skip very white or very black pixels
        const brightness = (r + g + b) / 3;
        if (brightness > 240 || brightness < 15) continue;

        // Skip very desaturated (gray) pixels
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.1 && brightness > 50 && brightness < 200) continue;

        colors.push({ r, g, b });
    }

    // If we got very few colors after filtering, relax constraints
    if (colors.length < 10) {
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];
            if (a < 64) continue;
            const brightness = (r + g + b) / 3;
            if (brightness > 250 || brightness < 5) continue;
            colors.push({ r, g, b });
        }
    }

    // Fallback if image is all white/black/transparent
    if (colors.length === 0) {
        return {
            primary: '#6D28D9',
            secondary: '#2563EB',
            palette: ['#6D28D9', '#2563EB', '#7C3AED', '#3B82F6', '#8B5CF6'],
        };
    }

    // Simple k-means clustering with k=5
    const clusters = kMeansClustering(colors, 5);

    // Sort by cluster size (most frequent first)
    clusters.sort((a, b) => b.count - a.count);

    // Convert to hex
    const palette = clusters.map(c => rgbToHex(c.center));

    // Pick the most saturated color as primary
    const sorted = clusters
        .map(c => ({ ...c, saturation: getSaturation(c.center) }))
        .sort((a, b) => b.saturation - a.saturation);

    const primary = rgbToHex(sorted[0]?.center || clusters[0].center);

    // Secondary: the next most different color
    let secondary = palette[1] || palette[0];
    if (sorted.length > 1) {
        // Find the most different color from primary
        const primaryRgb = sorted[0].center;
        let maxDiff = 0;
        for (let i = 1; i < sorted.length; i++) {
            const diff = colorDistance(primaryRgb, sorted[i].center);
            if (diff > maxDiff) {
                maxDiff = diff;
                secondary = rgbToHex(sorted[i].center);
            }
        }
    }

    return { primary, secondary, palette };
}

// ============================================================================
// K-Means Clustering (simplified)
// ============================================================================

interface Cluster {
    center: RGB;
    count: number;
}

function kMeansClustering(colors: RGB[], k: number, iterations = 10): Cluster[] {
    if (colors.length <= k) {
        return colors.map(c => ({ center: c, count: 1 }));
    }

    // Initialize centers by picking evenly spaced colors
    const step = Math.floor(colors.length / k);
    const centers: RGB[] = [];
    for (let i = 0; i < k; i++) {
        centers.push({ ...colors[i * step] });
    }

    const assignments = new Array(colors.length).fill(0);

    for (let iter = 0; iter < iterations; iter++) {
        // Assign each color to nearest center
        for (let i = 0; i < colors.length; i++) {
            let minDist = Infinity;
            let nearest = 0;
            for (let j = 0; j < centers.length; j++) {
                const dist = colorDistance(colors[i], centers[j]);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = j;
                }
            }
            assignments[i] = nearest;
        }

        // Recalculate centers
        const sums: { r: number; g: number; b: number; count: number }[] =
            centers.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

        for (let i = 0; i < colors.length; i++) {
            const cluster = assignments[i];
            sums[cluster].r += colors[i].r;
            sums[cluster].g += colors[i].g;
            sums[cluster].b += colors[i].b;
            sums[cluster].count++;
        }

        for (let j = 0; j < centers.length; j++) {
            if (sums[j].count > 0) {
                centers[j] = {
                    r: Math.round(sums[j].r / sums[j].count),
                    g: Math.round(sums[j].g / sums[j].count),
                    b: Math.round(sums[j].b / sums[j].count),
                };
            }
        }
    }

    // Count final assignments
    const counts = new Array(k).fill(0);
    for (const a of assignments) counts[a]++;

    return centers.map((center, i) => ({ center, count: counts[i] }))
        .filter(c => c.count > 0);
}

// ============================================================================
// Helpers
// ============================================================================

function colorDistance(a: RGB, b: RGB): number {
    return Math.sqrt(
        (a.r - b.r) ** 2 +
        (a.g - b.g) ** 2 +
        (a.b - b.b) ** 2
    );
}

function getSaturation(c: RGB): number {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    return max === 0 ? 0 : (max - min) / max;
}

function rgbToHex(c: RGB): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}
