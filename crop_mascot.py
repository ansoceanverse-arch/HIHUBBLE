from PIL import Image, ImageChops

def trim_and_make_square(im):
    # Find bounding box
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    
    if bbox:
        im_cropped = im.crop(bbox)
        
        # Make square
        width, height = im_cropped.size
        size = max(width, height)
        # We want the mascot perfectly centered, with maybe 5% padding
        padded_size = int(size * 1.1)
        new_im = Image.new('RGBA', (padded_size, padded_size), (255, 255, 255, 0))
        # Paste centered
        x = (padded_size - width) // 2
        y = (padded_size - height) // 2
        new_im.paste(im_cropped, (x, y))
        return new_im
    return im

# Process
try:
    img = Image.open('public/hihubble-mascot.png')
    img = img.convert("RGBA")
    square_img = trim_and_make_square(img)
    square_img.save('public/hihubble-mascot-circle.png')
    print("Successfully created public/hihubble-mascot-circle.png")
except Exception as e:
    print(f"Error: {e}")
