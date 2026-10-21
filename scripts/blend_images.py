#!/usr/bin/env python3
"""
Image blending script using OpenCV
Supports multiple blend modes for combining two images
"""

import sys
import cv2
import numpy as np

def resize_to_match(img1, img2):
    """Resize images to match dimensions (use smaller dimensions)"""
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]

    # Use the smaller dimensions to avoid upscaling
    target_h = min(h1, h2)
    target_w = min(w1, w2)

    img1_resized = cv2.resize(img1, (target_w, target_h), interpolation=cv2.INTER_AREA)
    img2_resized = cv2.resize(img2, (target_w, target_h), interpolation=cv2.INTER_AREA)

    return img1_resized, img2_resized

def normalize_image(img):
    """Convert image to float32 and normalize to 0-1 range"""
    return img.astype(np.float32) / 255.0

def denormalize_image(img):
    """Convert normalized image back to uint8"""
    return np.clip(img * 255.0, 0, 255).astype(np.uint8)

def blend_normal(img1, img2, alpha):
    """Normal alpha blending"""
    return cv2.addWeighted(img1, alpha, img2, 1 - alpha, 0)

def blend_additive(img1, img2, alpha):
    """Additive blending"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)
    blended = img1_norm * alpha + img2_norm * (1 - alpha)
    blended = np.clip(blended + img2_norm * alpha, 0, 1)
    return denormalize_image(blended)

def blend_multiply(img1, img2, alpha):
    """Multiply blending (darkens)"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)
    multiplied = img1_norm * img2_norm
    blended = img1_norm * (1 - alpha) + multiplied * alpha
    return denormalize_image(blended)

def blend_screen(img1, img2, alpha):
    """Screen blending (lightens) - inverted multiply"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)
    screened = 1 - (1 - img1_norm) * (1 - img2_norm)
    blended = img1_norm * (1 - alpha) + screened * alpha
    return denormalize_image(blended)

def blend_overlay(img1, img2, alpha):
    """Overlay blending - combination of multiply and screen"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)

    # Where img1 < 0.5, use multiply; otherwise use screen
    mask = img1_norm < 0.5
    overlay = np.where(
        mask,
        2 * img1_norm * img2_norm,
        1 - 2 * (1 - img1_norm) * (1 - img2_norm)
    )
    blended = img1_norm * (1 - alpha) + overlay * alpha
    return denormalize_image(blended)

def blend_difference(img1, img2, alpha):
    """Difference blending - absolute difference"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)
    diff = np.abs(img1_norm - img2_norm)
    blended = img1_norm * (1 - alpha) + diff * alpha
    return denormalize_image(blended)

def blend_lighten(img1, img2, alpha):
    """Lighten blending - takes lighter pixels"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)
    lightened = np.maximum(img1_norm, img2_norm)
    blended = img1_norm * (1 - alpha) + lightened * alpha
    return denormalize_image(blended)

def blend_darken(img1, img2, alpha):
    """Darken blending - takes darker pixels"""
    img1_norm = normalize_image(img1)
    img2_norm = normalize_image(img2)
    darkened = np.minimum(img1_norm, img2_norm)
    blended = img1_norm * (1 - alpha) + darkened * alpha
    return denormalize_image(blended)

def blend_images(img1_path, img2_path, output_path, mode='normal', alpha=0.5):
    """
    Blend two images using specified mode

    Args:
        img1_path: Path to first image
        img2_path: Path to second image
        output_path: Path to save blended image
        mode: Blending mode (normal, additive, multiply, screen, overlay, difference, lighten, darken)
        alpha: Blending factor (0.0 to 1.0)
    """
    # Read images
    img1 = cv2.imread(img1_path)
    img2 = cv2.imread(img2_path)

    if img1 is None:
        raise ValueError(f"Failed to load image: {img1_path}")
    if img2 is None:
        raise ValueError(f"Failed to load image: {img2_path}")

    # Resize to match dimensions
    img1, img2 = resize_to_match(img1, img2)

    # Convert alpha to float
    alpha = float(alpha)
    if alpha < 0 or alpha > 1:
        raise ValueError("Alpha must be between 0 and 1")

    # Apply blending based on mode
    blend_functions = {
        'normal': blend_normal,
        'additive': blend_additive,
        'multiply': blend_multiply,
        'screen': blend_screen,
        'overlay': blend_overlay,
        'difference': blend_difference,
        'lighten': blend_lighten,
        'darken': blend_darken
    }

    if mode not in blend_functions:
        raise ValueError(f"Invalid blend mode: {mode}. Valid modes: {', '.join(blend_functions.keys())}")

    # Blend images
    blended = blend_functions[mode](img1, img2, alpha)

    # Save result
    cv2.imwrite(output_path, blended)
    print(f"Successfully blended images using {mode} mode (alpha={alpha})")
    print(f"Output saved to: {output_path}")
    print(f"Output dimensions: {blended.shape[1]}x{blended.shape[0]}")

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: python blend_images.py <image1> <image2> <output> <mode> [alpha]")
        print("Modes: normal, additive, multiply, screen, overlay, difference, lighten, darken")
        print("Alpha: 0.0 to 1.0 (default: 0.5)")
        sys.exit(1)

    img1_path = sys.argv[1]
    img2_path = sys.argv[2]
    output_path = sys.argv[3]
    mode = sys.argv[4] if len(sys.argv) > 4 else 'normal'
    alpha = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5

    try:
        blend_images(img1_path, img2_path, output_path, mode, alpha)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
