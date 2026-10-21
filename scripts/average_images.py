#!/usr/bin/env python3
"""
Image averaging script using OpenCV
Takes multiple images and averages them together
"""

import sys
import cv2
import numpy as np
import json

def average_images(image_paths, output_path):
    """
    Average multiple images together

    Args:
        image_paths: List of paths to images to average
        output_path: Path to save averaged image
    """
    if not image_paths:
        raise ValueError("No images provided")

    if len(image_paths) < 2:
        raise ValueError("At least 2 images required for averaging")

    # Read first image to get dimensions
    first_img = cv2.imread(image_paths[0])
    if first_img is None:
        raise ValueError(f"Failed to load image: {image_paths[0]}")

    target_height, target_width = first_img.shape[:2]

    # Initialize accumulator as float64 for precision
    accumulated = np.zeros((target_height, target_width, 3), dtype=np.float64)
    valid_count = 0

    # Load and accumulate all images
    for i, img_path in enumerate(image_paths):
        img = cv2.imread(img_path)

        if img is None:
            print(f"Warning: Failed to load image {i+1}: {img_path}", file=sys.stderr)
            continue

        # Resize to match target dimensions if needed
        if img.shape[:2] != (target_height, target_width):
            img = cv2.resize(img, (target_width, target_height), interpolation=cv2.INTER_AREA)

        # Add to accumulator
        accumulated += img.astype(np.float64)
        valid_count += 1

    if valid_count == 0:
        raise ValueError("No valid images could be loaded")

    # Calculate average
    averaged = (accumulated / valid_count).astype(np.uint8)

    # Save result
    success = cv2.imwrite(output_path, averaged)
    if not success:
        raise ValueError(f"Failed to save output image to: {output_path}")

    return {
        'success': True,
        'images_processed': valid_count,
        'output_path': output_path,
        'dimensions': f'{target_width}x{target_height}'
    }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python average_images.py <output_path> <image1> <image2> [image3] ...")
        sys.exit(1)

    output_path = sys.argv[1]
    image_paths = sys.argv[2:]

    try:
        result = average_images(image_paths, output_path)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)
