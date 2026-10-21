const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// Temporary directory for uploaded images
const UPLOAD_DIR = path.join(__dirname, '../temp_uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create upload directory:', error);
  }
}

ensureUploadDir();

// Parse base64 image data and save to temporary file
async function saveBase64Image(base64Data, filename) {
  const matches = base64Data.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid image data format');
  }

  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const imageBuffer = Buffer.from(matches[2], 'base64');
  const filepath = path.join(UPLOAD_DIR, `${filename}.${extension}`);

  await fs.writeFile(filepath, imageBuffer);
  return filepath;
}

// Clean up temporary files
async function cleanupFiles(files) {
  for (const file of files) {
    try {
      await fs.unlink(file);
    } catch (error) {
      console.error('Failed to delete temp file:', error);
    }
  }
}

// Execute Python blending script
function executePythonBlend(image1Path, image2Path, blendMode, alpha = 0.5) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../scripts/blend_images.py');
    const outputPath = path.join(UPLOAD_DIR, `blended_${uuidv4()}.png`);

    const args = [
      pythonScript,
      image1Path,
      image2Path,
      outputPath,
      blendMode,
      alpha.toString()
    ];

    const pythonProcess = spawn('python3', args);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ outputPath, stdout, stderr });
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

// POST /api/blending-images/blend
// Body: { image1: base64, image2: base64, mode: string, alpha: number }
router.post('/blend', async (req, res) => {
  const tempFiles = [];

  try {
    const { image1, image2, mode = 'normal', alpha = 0.5 } = req.body;

    // Validate inputs
    if (!image1 || !image2) {
      return res.status(400).json({ error: 'Both image1 and image2 are required' });
    }

    const validModes = ['normal', 'additive', 'multiply', 'screen', 'overlay', 'difference', 'lighten', 'darken'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: `Invalid blend mode. Valid modes: ${validModes.join(', ')}`
      });
    }

    const alphaNum = parseFloat(alpha);
    if (isNaN(alphaNum) || alphaNum < 0 || alphaNum > 1) {
      return res.status(400).json({ error: 'Alpha must be a number between 0 and 1' });
    }

    // Save uploaded images to temporary files
    const image1Path = await saveBase64Image(image1, `img1_${uuidv4()}`);
    const image2Path = await saveBase64Image(image2, `img2_${uuidv4()}`);
    tempFiles.push(image1Path, image2Path);

    // Execute Python blending
    const { outputPath, stdout, stderr } = await executePythonBlend(
      image1Path,
      image2Path,
      mode,
      alphaNum
    );
    tempFiles.push(outputPath);

    // Read the blended image and convert to base64
    const blendedImageBuffer = await fs.readFile(outputPath);
    const blendedImageBase64 = `data:image/png;base64,${blendedImageBuffer.toString('base64')}`;

    // Clean up temporary files
    await cleanupFiles(tempFiles);

    res.json({
      success: true,
      blendedImage: blendedImageBase64,
      mode,
      alpha: alphaNum,
      message: 'Images blended successfully'
    });

  } catch (error) {
    console.error('Blending error:', error);

    // Clean up temporary files on error
    if (tempFiles.length > 0) {
      await cleanupFiles(tempFiles);
    }

    res.status(500).json({
      error: 'Failed to blend images',
      details: error.message
    });
  }
});

// Execute Python averaging script for multiple images
function executePythonAverage(imagePaths) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../scripts/average_images.py');
    const outputPath = path.join(UPLOAD_DIR, `averaged_${uuidv4()}.png`);

    const args = [
      pythonScript,
      outputPath,
      ...imagePaths
    ];

    const pythonProcess = spawn('python3', args);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ outputPath, stdout, stderr });
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

// Execute Python pyramid averaging script for multiple images
function executePythonPyramid(imagePaths, outputPrefix, numLevels = 4) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../scripts/pyramid_average.py');

    const args = [
      pythonScript,
      outputPrefix,
      numLevels.toString(),
      ...imagePaths
    ];

    const pythonProcess = spawn('python3', args);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        try {
          // Parse JSON output from Python script
          const result = JSON.parse(stdout);
          resolve({ result, stderr });
        } catch (parseError) {
          reject(new Error(`Failed to parse Python output: ${parseError.message}`));
        }
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

// POST /api/blending-images/average
// Body: { images: [base64, base64, ...] }
router.post('/average', async (req, res) => {
  const tempFiles = [];

  try {
    const { images } = req.body;

    // Validate inputs
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images array is required' });
    }

    if (images.length < 2) {
      return res.status(400).json({ error: 'At least 2 images are required' });
    }

    if (images.length > 15) {
      return res.status(400).json({ error: 'Maximum 15 images allowed' });
    }

    // Save all uploaded images to temporary files
    const imagePaths = [];
    for (let i = 0; i < images.length; i++) {
      const imagePath = await saveBase64Image(images[i], `avg_img${i}_${uuidv4()}`);
      tempFiles.push(imagePath);
      imagePaths.push(imagePath);
    }

    // Execute Python averaging
    const { outputPath, stdout, stderr } = await executePythonAverage(imagePaths);
    tempFiles.push(outputPath);

    // Read the averaged image and convert to base64
    const averagedImageBuffer = await fs.readFile(outputPath);
    const averagedImageBase64 = `data:image/png;base64,${averagedImageBuffer.toString('base64')}`;

    // Clean up temporary files
    await cleanupFiles(tempFiles);

    res.json({
      success: true,
      averagedImage: averagedImageBase64,
      imagesProcessed: images.length,
      message: 'Images averaged successfully'
    });

  } catch (error) {
    console.error('Averaging error:', error);

    // Clean up temporary files on error
    if (tempFiles.length > 0) {
      await cleanupFiles(tempFiles);
    }

    res.status(500).json({
      error: 'Failed to average images',
      details: error.message
    });
  }
});

// POST /api/blending-images/pyramid
// Body: { images: [base64, base64, ...], levels: number }
// Returns averaged images at multiple scales (original, 1/2, 1/4, 1/8)
router.post('/pyramid', async (req, res) => {
  const tempFiles = [];

  try {
    const { images, comparisonImage, levels = 4 } = req.body;

    // Validate inputs
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images array is required' });
    }

    if (images.length < 1) {
      return res.status(400).json({ error: 'At least 1 image is required' });
    }

    if (images.length > 15) {
      return res.status(400).json({ error: 'Maximum 15 images allowed' });
    }

    const numLevels = parseInt(levels);
    if (isNaN(numLevels) || numLevels < 1 || numLevels > 6) {
      return res.status(400).json({ error: 'Levels must be between 1 and 6' });
    }

    // Save all uploaded images to temporary files
    const imagePaths = [];
    for (let i = 0; i < images.length; i++) {
      const imagePath = await saveBase64Image(images[i], `pyr_img${i}_${uuidv4()}`);
      tempFiles.push(imagePath);
      imagePaths.push(imagePath);
    }

    // Execute Python pyramid averaging
    const outputPrefix = path.join(UPLOAD_DIR, `pyramid_${uuidv4()}`);
    const { result, stderr } = await executePythonPyramid(imagePaths, outputPrefix, numLevels);

    // Process comparison image if provided
    let comparisonPyramidLevels = [];
    if (comparisonImage) {
      const comparisonPath = await saveBase64Image(comparisonImage, `comp_img_${uuidv4()}`);
      tempFiles.push(comparisonPath);

      const comparisonPrefix = path.join(UPLOAD_DIR, `comparison_${uuidv4()}`);
      const comparisonResult = await executePythonPyramid([comparisonPath], comparisonPrefix, numLevels);

      for (const level of comparisonResult.result.pyramid) {
        const imageBuffer = await fs.readFile(level.output_path);
        const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        comparisonPyramidLevels.push({
          level: level.level,
          blockSize: level.block_size,
          scale: level.scale,
          dimensions: level.dimensions,
          width: level.width,
          height: level.height,
          image: imageBase64
        });

        tempFiles.push(level.output_path);
      }
    }

    // Read all generated pyramid level images and convert to base64
    const pyramidLevels = [];
    for (const level of result.pyramid) {
      const imageBuffer = await fs.readFile(level.output_path);
      const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      pyramidLevels.push({
        level: level.level,
        blockSize: level.block_size,
        scale: level.scale,
        dimensions: level.dimensions,
        width: level.width,
        height: level.height,
        image: imageBase64
      });

      // Add to cleanup list
      tempFiles.push(level.output_path);
    }

    // Clean up temporary files
    await cleanupFiles(tempFiles);

    res.json({
      success: true,
      pyramid: pyramidLevels,
      comparisonPyramid: comparisonPyramidLevels,
      numImages: result.num_images,
      levelsGenerated: result.levels_generated,
      message: 'Pyramid averaged successfully'
    });

  } catch (error) {
    console.error('Pyramid averaging error:', error);

    // Clean up temporary files on error
    if (tempFiles.length > 0) {
      await cleanupFiles(tempFiles);
    }

    res.status(500).json({
      error: 'Failed to create pyramid average',
      details: error.message
    });
  }
});

// GET /api/blending-images/modes
// Returns available blending modes
router.get('/modes', (req, res) => {
  res.json({
    modes: [
      { value: 'normal', label: 'Normal (Alpha Blend)', description: 'Standard alpha blending between two images' },
      { value: 'additive', label: 'Additive', description: 'Adds pixel values from both images' },
      { value: 'multiply', label: 'Multiply', description: 'Multiplies pixel values (darkens)' },
      { value: 'screen', label: 'Screen', description: 'Inverted multiply (lightens)' },
      { value: 'overlay', label: 'Overlay', description: 'Combination of multiply and screen' },
      { value: 'difference', label: 'Difference', description: 'Absolute difference between images' },
      { value: 'lighten', label: 'Lighten', description: 'Takes lighter pixels from both images' },
      { value: 'darken', label: 'Darken', description: 'Takes darker pixels from both images' }
    ]
  });
});

module.exports = router;
