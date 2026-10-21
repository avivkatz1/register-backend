# Pyramid Averaging API Documentation

## Endpoint: POST `/api/blending-images/pyramid`

Creates a multi-scale pyramid of averaged images with pixel quantization. Takes multiple images, averages them together, then creates increasingly blocky/pixelated versions by quantizing pixels into blocks (2x2, 4x4, 8x8, etc.). All output images maintain the same resolution but with increasing blockiness.

**No authentication required.**

### Request Body
```json
{
  "images": [
    "data:image/png;base64,...",
    "data:image/jpeg;base64,...",
    "data:image/png;base64,..."
  ],
  "levels": 4
}
```

**Parameters:**
- `images` (required): Array of base64-encoded image data URLs
  - Minimum: 1 image
  - Maximum: 15 images
  - Supported formats: PNG, JPEG, WebP

- `levels` (optional): Number of pyramid levels to generate (default: 4)
  - Minimum: 1
  - Maximum: 6
  - Each level doubles the block size (1, 2, 4, 8, 16, 32, etc.)
  - Controls how many quantized images are returned

### Response
```json
{
  "success": true,
  "pyramid": [
    {
      "level": 0,
      "block_size": 1,
      "scale": "original",
      "dimensions": "1024x768",
      "width": 1024,
      "height": 768,
      "image": "data:image/png;base64,..."
    },
    {
      "level": 1,
      "block_size": 2,
      "scale": "2x2 blocks",
      "dimensions": "1024x768",
      "width": 1024,
      "height": 768,
      "image": "data:image/png;base64,..."
    },
    {
      "level": 2,
      "block_size": 4,
      "scale": "4x4 blocks",
      "dimensions": "1024x768",
      "width": 1024,
      "height": 768,
      "image": "data:image/png;base64,..."
    },
    {
      "level": 3,
      "block_size": 8,
      "scale": "8x8 blocks",
      "dimensions": "1024x768",
      "width": 1024,
      "height": 768,
      "image": "data:image/png;base64,..."
    }
  ],
  "numImages": 3,
  "levelsGenerated": 4,
  "message": "Pyramid averaged successfully"
}
```

### Response Fields
- `success`: Boolean indicating success
- `pyramid`: Array of pyramid levels (sorted from least to most blocky)
  - `level`: Level number (0 = original, 1 = 2x2 blocks, 2 = 4x4 blocks, etc.)
  - `block_size`: Size of quantization blocks (1, 2, 4, 8, 16, etc.)
  - `scale`: Human-readable description of blockiness
  - `dimensions`: Image dimensions as "WIDTHxHEIGHT" (same for all levels)
  - `width`: Image width in pixels (same for all levels)
  - `height`: Image height in pixels (same for all levels)
  - `image`: Base64-encoded PNG image data URL
- `numImages`: Number of input images processed
- `levelsGenerated`: Number of pyramid levels created
- `message`: Success message

### Error Responses

**400 Bad Request:**
```json
{
  "error": "Images array is required"
}
```

**400 Bad Request:**
```json
{
  "error": "At least 1 image is required"
}
```

**400 Bad Request:**
```json
{
  "error": "Maximum 15 images allowed"
}
```

**400 Bad Request:**
```json
{
  "error": "Levels must be between 1 and 6"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create pyramid average",
  "details": "Error message details"
}
```

### Example Usage (JavaScript/React)

```javascript
const createPyramid = async (imageArray) => {
  const response = await fetch('/api/blending-images/pyramid', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      images: imageArray,  // Array of base64 data URLs
      levels: 4            // Optional, default is 4
    })
  });

  const data = await response.json();

  if (data.success) {
    // data.pyramid is an array of pyramid levels
    // Each level has: level, scale, dimensions, width, height, image
    console.log(`Generated ${data.levelsGenerated} levels from ${data.numImages} images`);

    // Display each level
    data.pyramid.forEach(level => {
      console.log(`Level ${level.level}: ${level.scale} (${level.dimensions})`);
      // level.image contains the base64 data URL you can use in <img> tags
    });
  }

  return data;
};
```

### Example Usage (curl)

```bash
curl -X POST http://localhost:3001/api/blending-images/pyramid \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      "data:image/png;base64,iVBORw0KGgo...",
      "data:image/png;base64,iVBORw0KGgo...",
      "data:image/png;base64,iVBORw0KGgo..."
    ],
    "levels": 4
  }'
```

## How It Works

1. **Input**: Multiple images of potentially different sizes
2. **Resize**: All images are resized to match the smallest dimensions
3. **Average**: All images are averaged together into one base image
4. **Level 0** (Original): The averaged image with no quantization
5. **Level 1** (2x2 blocks): Average each 2x2 pixel block and fill with that color
6. **Level 2** (4x4 blocks): Average each 4x4 pixel block and fill with that color
7. **Level 3** (8x8 blocks): Average each 8x8 pixel block and fill with that color
8. **Output**: Returns all pyramid levels as base64-encoded PNGs (all same resolution)

## Use Cases

- **Noise reduction**: Averaging multiple images reduces noise
- **Artistic effects**: Create pixelated/mosaic art from photos
- **Privacy**: Blur faces/details by showing only blocky version
- **Data visualization**: Show progression from detailed to abstract
- **Image analysis**: Compare detail levels at different granularities
- **Retro aesthetics**: Create pixel-art style images
- **Progressive reveal**: Show increasingly detailed versions

## Performance Notes

- Processing time increases with number of images and levels
- Quantization is fast - most time is spent averaging input images
- Larger input images take longer to process
- All images are automatically resized to match dimensions
- All output images have the same resolution (same file size approximately)
- Generated images are returned as PNG (lossless)
- Temporary files are automatically cleaned up after each request

## Backend Implementation

The endpoint calls `scripts/pyramid_average.py` which:
1. Loads all input images
2. Resizes them to matching dimensions
3. Averages all images together into one base image
4. Creates pyramid levels by quantizing pixels into blocks
5. Level 0: Original averaged image (1x1 blocks = no quantization)
6. Level 1: 2x2 blocks (each 2x2 pixel area becomes one solid color)
7. Level 2: 4x4 blocks (each 4x4 pixel area becomes one solid color)
8. Level 3+: 8x8, 16x16, etc. (exponentially larger blocks)
9. Saves each level as a PNG file
10. Returns JSON with file paths and metadata
11. Node.js reads the files, converts to base64, and returns to client
