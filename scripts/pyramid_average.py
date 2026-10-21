#!/usr/bin/env python3
"""
Multi-scale pyramid averaging script with pixel quantization
Takes multiple images, averages them, then creates blocky/pixelated versions
by quantizing pixels into blocks (2x2, 4x4, 8x8, etc.)
All output images maintain the same resolution but with increasing blockiness
"""

import sys
import cv2
import numpy as np
import json

def resize_images_to_match(images, max_dimension=800):
    """Resize all images to match the smallest dimensions and limit max size"""
    if not images:
        return []

    # Find minimum dimensions across all images
    min_h = min(img.shape[0] for img in images)
    min_w = min(img.shape[1] for img in images)

    # Limit dimensions to max_dimension to reduce memory usage
    if min_h > max_dimension or min_w > max_dimension:
        scale = max_dimension / max(min_h, min_w)
        min_h = int(min_h * scale)
        min_w = int(min_w * scale)

    # Resize all images to match
    resized = []
    for img in images:
        if img.shape[0] != min_h or img.shape[1] != min_w:
            resized_img = cv2.resize(img, (min_w, min_h), interpolation=cv2.INTER_AREA)
            resized.append(resized_img)
        else:
            resized.append(img)

    return resized

def average_images(images):
    """Average multiple images together"""
    if not images:
        raise ValueError("No images to average")

    if len(images) == 1:
        return images[0]

    # Convert to float for accurate averaging
    images_float = [img.astype(np.float64) for img in images]

    # Sum all images
    averaged = np.zeros_like(images_float[0])
    for img in images_float:
        averaged += img

    # Divide by number of images
    averaged = averaged / len(images)

    # Convert back to uint8
    return np.clip(averaged, 0, 255).astype(np.uint8)

def quantize_image(image, block_size):
    """
    Quantize/pixelate image by averaging blocks of pixels
    Keeps the same image size but makes it blocky

    Args:
        image: Input image
        block_size: Size of blocks (e.g., 2 for 2x2, 4 for 4x4)

    Returns:
        Quantized image with same dimensions as input
    """
    if block_size <= 1:
        return image.copy()

    h, w = image.shape[:2]
    quantized = image.copy()

    # Process image in blocks
    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            # Get block boundaries (handle edges that don't align)
            y_end = min(y + block_size, h)
            x_end = min(x + block_size, w)

            # Extract block
            block = image[y:y_end, x:x_end]

            # Calculate average color for this block
            avg_color = np.mean(block, axis=(0, 1))

            # Fill the entire block with the average color
            quantized[y:y_end, x:x_end] = avg_color

    return quantized

def create_pyramid_average(image_paths, output_prefix, num_levels=4):
    """
    Create multi-scale pyramid of averaged images with pixel quantization

    Args:
        image_paths: List of paths to input images
        output_prefix: Prefix for output filenames
        num_levels: Number of pyramid levels (default 4)

    Returns:
        Dictionary with pyramid information
    """
    # Load all images
    images = []
    for path in image_paths:
        img = cv2.imread(path)
        if img is None:
            raise ValueError(f"Failed to load image: {path}")
        images.append(img)

    if not images:
        raise ValueError("No images loaded")

    # Resize all images to match dimensions
    images = resize_images_to_match(images)

    # Average all images together once
    base_averaged = average_images(images)
    h, w = base_averaged.shape[:2]

    # Store results for each level
    pyramid_results = []

    for level in range(num_levels):
        # Calculate block size for this level (1, 2, 4, 8, 16, etc.)
        block_size = 2 ** level if level > 0 else 1

        # Quantize the averaged image
        if block_size == 1:
            # Level 0: original averaged image (no quantization)
            quantized = base_averaged.copy()
        else:
            # Higher levels: quantize with increasing block sizes
            quantized = quantize_image(base_averaged, block_size)

        # Save quantized image
        output_path = f"{output_prefix}_level{level}.png"
        cv2.imwrite(output_path, quantized)

        # Store result info
        pyramid_results.append({
            'level': level,
            'block_size': block_size,
            'scale': f'{block_size}x{block_size} blocks' if block_size > 1 else 'original',
            'dimensions': f'{w}x{h}',
            'width': w,
            'height': h,
            'output_path': output_path
        })

        # Stop if blocks become too large for the image
        if block_size >= min(h, w) // 2:
            break

    return {
        'num_images': len(image_paths),
        'levels_generated': len(pyramid_results),
        'base_dimensions': f'{w}x{h}',
        'pyramid': pyramid_results
    }

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python pyramid_average.py <output_prefix> <num_levels> <image1> <image2> [image3] ...", file=sys.stderr)
        print("Example: python pyramid_average.py /tmp/pyramid 4 img1.jpg img2.jpg img3.jpg", file=sys.stderr)
        sys.exit(1)

    output_prefix = sys.argv[1]
    num_levels = int(sys.argv[2])
    image_paths = sys.argv[3:]

    if len(image_paths) < 1:
        print("Error: At least one image is required", file=sys.stderr)
        sys.exit(1)

    if num_levels < 1:
        print("Error: Number of levels must be at least 1", file=sys.stderr)
        sys.exit(1)

    try:
        result = create_pyramid_average(image_paths, output_prefix, num_levels)

        # Print result as JSON for easy parsing by Node.js
        print(json.dumps(result, indent=2))

        # Also print human-readable summary to stderr (won't interfere with JSON parsing)
        print(f"\n✓ Successfully created {result['levels_generated']} pyramid levels from {result['num_images']} images", file=sys.stderr)
        print(f"  Base dimensions: {result['base_dimensions']}", file=sys.stderr)
        for level_info in result['pyramid']:
            print(f"  Level {level_info['level']}: {level_info['scale']} - {level_info['dimensions']}", file=sys.stderr)

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
