import AppKit

guard CommandLine.arguments.count == 3 else {
    fatalError("Expected app-icon and menu-icon output paths")
}

let appIcon = NSImage(size: NSSize(width: 1024, height: 1024), flipped: false) { _ in
    NSColor(calibratedRed: 0.87, green: 0.36, blue: 0.23, alpha: 1).setFill()
    NSBezierPath(
        roundedRect: NSRect(x: 62, y: 62, width: 900, height: 900),
        xRadius: 205,
        yRadius: 205
    ).fill()

    NSColor.white.setStroke()
    NSColor.white.setFill()
    let house = NSBezierPath()
    house.lineWidth = 92
    house.lineCapStyle = .round
    house.lineJoinStyle = .round
    house.move(to: NSPoint(x: 246, y: 514))
    house.line(to: NSPoint(x: 512, y: 742))
    house.line(to: NSPoint(x: 778, y: 514))
    house.move(to: NSPoint(x: 292, y: 520))
    house.line(to: NSPoint(x: 352, y: 294))
    house.line(to: NSPoint(x: 672, y: 294))
    house.line(to: NSPoint(x: 732, y: 520))
    house.stroke()
    NSBezierPath(ovalIn: NSRect(x: 454, y: 444, width: 116, height: 116)).fill()
    return true
}

let menuIcon = NSImage(size: NSSize(width: 36, height: 36), flipped: false) { _ in
    NSColor.black.setStroke()
    NSColor.black.setFill()

    let house = NSBezierPath()
    house.lineWidth = 5
    house.lineCapStyle = .round
    house.lineJoinStyle = .round
    house.move(to: NSPoint(x: 4, y: 18))
    house.line(to: NSPoint(x: 18, y: 31))
    house.line(to: NSPoint(x: 32, y: 18))
    house.move(to: NSPoint(x: 7, y: 19))
    house.line(to: NSPoint(x: 10, y: 5))
    house.line(to: NSPoint(x: 26, y: 5))
    house.line(to: NSPoint(x: 29, y: 19))
    house.stroke()

    NSBezierPath(ovalIn: NSRect(x: 14.5, y: 14, width: 7, height: 7)).fill()
    return true
}

func writePNG(_ image: NSImage, to path: String) throws {
    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:])
    else {
        fatalError("Could not render icon")
    }
    try png.write(to: URL(fileURLWithPath: path))
}

try writePNG(appIcon, to: CommandLine.arguments[1])
try writePNG(menuIcon, to: CommandLine.arguments[2])
