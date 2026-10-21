# Image Blending Setup Guide

This guide explains how to set up and use the image blending feature.

## Prerequisites

### 1. Install Python 3
Make sure Python 3 is installed on your system:
```bash
python3 --version
```

### 2. Install Python Dependencies
Install the required Python packages:
```bash
pip3 install -r requirements.txt
```

Or install manually:
```bash
pip3 install opencv-python numpy
```

### 3. Make Python Script Executable (Optional)
```bash
chmod +x scripts/blend_images.py
```

## API Endpoints

### POST `/api/blending-images/blend`
Blend two images using a specified mode.

**Request Body:**
```json
{
  "image1": "data:image/png;base64,...",
  "image2": "data:image/jpeg;base64,...",
  "mode": "normal",
  "alpha": 0.5
}
```

**Parameters:**
- `image1` (required): Base64-encoded image data URL
- `image2` (required): Base64-encoded image data URL
- `mode` (optional): Blending mode (default: "normal")
- `alpha` (optional): Blending intensity, 0.0 to 1.0 (default: 0.5)

**Response:**
```json
{
  "success": true,
  "blendedImage": "data:image/png;base64,...",
  "mode": "normal",
  "alpha": 0.5,
  "message": "Images blended successfully"
}
```

### GET `/api/blending-images/modes`
Get available blending modes.

**Response:**
```json
{
  "modes": [
    {
      "value": "normal",
      "label": "Normal (Alpha Blend)",
      "description": "Standard alpha blending between two images"
    },
    ...
  ]
}
```

## Available Blending Modes

1. **normal** - Standard alpha blending
2. **additive** - Adds pixel values (brightens)
3. **multiply** - Multiplies pixel values (darkens)
4. **screen** - Inverted multiply (lightens)
5. **overlay** - Combination of multiply and screen
6. **difference** - Absolute difference between images
7. **lighten** - Takes lighter pixels from both images
8. **darken** - Takes darker pixels from both images

## Frontend Integration

Update your React component to use the new endpoint:

```javascript
const handleBlend = async () => {
  const response = await fetch('/api/blending-images/blend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${yourAuthToken}`
    },
    body: JSON.stringify({
      image1: base64Image1,
      image2: base64Image2,
      mode: 'overlay',
      alpha: 0.7
    })
  });

  const data = await response.json();
  setBlendedImage(data.blendedImage);
};
```

## Testing with curl

```bash
# Get available modes
curl http://localhost:3001/api/blending-images/modes \
  -H "Authorization: Bearer YOUR_TOKEN"

# Blend two images (simplified example)
curl -X POST http://localhost:3001/api/blending-images/blend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "image1": "data:image/png;base64,iVBORw0KG...",
    "image2": "data:image/png;base64,iVBORw0KG...",
    "mode": "overlay",
    "alpha": 0.6
  }'
```

## Temporary Files

The system creates temporary files during processing in `temp_uploads/`. These are automatically cleaned up after each request. If the server crashes during processing, you may need to manually clean this directory.

```bash
# Clean up temporary files manually
rm -rf temp_uploads/*
```

## Troubleshooting

### "Failed to start Python process"
- Ensure Python 3 is installed: `python3 --version`
- Check if the script path is correct
- Verify the script has execute permissions

### "Failed to load image"
- Ensure images are valid base64-encoded data URLs
- Check image format (PNG, JPEG, WEBP supported)
- Verify the base64 data is properly formatted

### "Module not found: cv2"
- Install OpenCV: `pip3 install opencv-python`
- Verify installation: `python3 -c "import cv2; print(cv2.__version__)"`

### Large image timeouts
- Reduce image size before uploading
- Increase request timeout in your HTTP client
- Consider implementing async processing for very large images

## Performance Notes

- Images are automatically resized to match dimensions (uses smaller of the two)
- Larger images will take longer to process
- Alpha blending (normal mode) is the fastest
- Overlay and screen modes are slightly slower due to additional calculations
