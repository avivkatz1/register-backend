#!/usr/bin/env python3
"""
Test script to verify image blending is working correctly
Creates sample images and tests all blend modes
"""

import cv2
import numpy as np
import os

def create_test_images():
    """Create simple test images for blending"""
    # Create a blue gradient image (256x256)
    img1 = np.zeros((256, 256, 3), dtype=np.uint8)
    for i in range(256):
        img1[i, :] = [i, 0, 255 - i]  # Blue to cyan gradient

    # Create a red gradient image (256x256)
    img2 = np.zeros((256, 256, 3), dtype=np.uint8)
    for i in range(256):
        img2[:, i] = [255 - i, i, 0]  # Red to green gradient

    return img1, img2

def main():
    print("Creating test images...")
    img1, img2 = create_test_images()

    # Create output directory
    output_dir = "test_output"
    os.makedirs(output_dir, exist_ok=True)

    # Save original test images
    cv2.imwrite(f"{output_dir}/test_img1.png", img1)
    cv2.imwrite(f"{output_dir}/test_img2.png", img2)
    print(f"✓ Created test images in {output_dir}/")

    # Import the blend_images module
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from blend_images import blend_images

    # Test all blend modes
    modes = ['normal', 'additive', 'multiply', 'screen', 'overlay', 'difference', 'lighten', 'darken']
    alphas = [0.3, 0.5, 0.7]

    print("\nTesting blend modes...")
    for mode in modes:
        for alpha in alphas:
            output_path = f"{output_dir}/blended_{mode}_alpha{alpha}.png"
            try:
                blend_images(
                    f"{output_dir}/test_img1.png",
                    f"{output_dir}/test_img2.png",
                    output_path,
                    mode,
                    alpha
                )
                print(f"✓ {mode:12} (α={alpha}) -> {output_path}")
            except Exception as e:
                print(f"✗ {mode:12} (α={alpha}) -> ERROR: {e}")

    print(f"\n✓ All tests complete! Check {output_dir}/ for results.")
    print("\nQuick visual check:")
    print(f"  - normal:     Smooth blend between images")
    print(f"  - additive:   Brighter, combined colors")
    print(f"  - multiply:   Darker, multiplied colors")
    print(f"  - screen:     Lighter, inverted multiply")
    print(f"  - overlay:    Enhanced contrast")
    print(f"  - difference: Shows color differences")
    print(f"  - lighten:    Takes lighter pixels")
    print(f"  - darken:     Takes darker pixels")

if __name__ == '__main__':
    try:
        import cv2
        print("✓ OpenCV is installed")
    except ImportError:
        print("✗ OpenCV is not installed. Run: pip3 install opencv-python")
        exit(1)

    try:
        import numpy
        print("✓ NumPy is installed")
    except ImportError:
        print("✗ NumPy is not installed. Run: pip3 install numpy")
        exit(1)

    print("\nAll dependencies are installed!\n")
    main()
