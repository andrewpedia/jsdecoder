/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MOZILLA_GFX_PATHHELPERS_H_
#define MOZILLA_GFX_PATHHELPERS_H_

#include "2D.h"
#include "mozilla/Constants.h"

namespace mozilla {
namespace gfx {

template <typename T>
void ArcToBezier(T* aSink, const Point &aOrigin, const Size &aRadius,
                 float aStartAngle, float aEndAngle, bool aAntiClockwise)
{
  Point startPoint(aOrigin.x + cos(aStartAngle) * aRadius.width,
                   aOrigin.y + sin(aStartAngle) * aRadius.height);

  aSink->LineTo(startPoint);

  // Clockwise we always sweep from the smaller to the larger angle, ccw
  // it's vice versa.
  if (!aAntiClockwise && (aEndAngle < aStartAngle)) {
    Float correction = Float(ceil((aStartAngle - aEndAngle) / (2.0f * M_PI)));
    aEndAngle += float(correction * 2.0f * M_PI);
  } else if (aAntiClockwise && (aStartAngle < aEndAngle)) {
    Float correction = (Float)ceil((aEndAngle - aStartAngle) / (2.0f * M_PI));
    aStartAngle += float(correction * 2.0f * M_PI);
  }

  // Sweeping more than 2 * pi is a full circle.
  if (!aAntiClockwise && (aEndAngle - aStartAngle > 2 * M_PI)) {
    aEndAngle = float(aStartAngle + 2.0f * M_PI);
  } else if (aAntiClockwise && (aStartAngle - aEndAngle > 2.0f * M_PI)) {
    aEndAngle = float(aStartAngle - 2.0f * M_PI);
  }

  // Calculate the total arc we're going to sweep.
  Float arcSweepLeft = fabs(aEndAngle - aStartAngle);

  Float sweepDirection = aAntiClockwise ? -1.0f : 1.0f;

  Float currentStartAngle = aStartAngle;

  while (arcSweepLeft > 0) {
    // We guarantee here the current point is the start point of the next
    // curve segment.
    Float currentEndAngle;

    if (arcSweepLeft > M_PI / 2.0f) {
      currentEndAngle = Float(currentStartAngle + M_PI / 2.0f * sweepDirection);
    } else {
      currentEndAngle = currentStartAngle + arcSweepLeft * sweepDirection;
    }

    Point currentStartPoint(aOrigin.x + cos(currentStartAngle) * aRadius.width,
                            aOrigin.y + sin(currentStartAngle) * aRadius.height);
    Point currentEndPoint(aOrigin.x + cos(currentEndAngle) * aRadius.width,
                          aOrigin.y + sin(currentEndAngle) * aRadius.height);

    // Calculate kappa constant for partial curve. The sign of angle in the
    // tangent will actually ensure this is negative for a counter clockwise
    // sweep, so changing signs later isn't needed.
    Float kappaFactor = (4.0f / 3.0f) * tan((currentEndAngle - currentStartAngle) / 4.0f);
    Float kappaX = kappaFactor * aRadius.width;
    Float kappaY = kappaFactor * aRadius.height;

    Point tangentStart(-sin(currentStartAngle), cos(currentStartAngle));
    Point cp1 = currentStartPoint;
    cp1 += Point(tangentStart.x * kappaX, tangentStart.y * kappaY);

    Point revTangentEnd(sin(currentEndAngle), -cos(currentEndAngle));
    Point cp2 = currentEndPoint;
    cp2 += Point(revTangentEnd.x * kappaX, revTangentEnd.y * kappaY);

    aSink->BezierTo(cp1, cp2, currentEndPoint);

    arcSweepLeft -= Float(M_PI / 2.0f);
    currentStartAngle = currentEndAngle;
  }
}

/* This is basically the ArcToBezier with the parameters for drawing a circle
 * inlined which vastly simplifies it and avoids a bunch of transcedental function
 * calls which should make it faster. */
template <typename T>
void EllipseToBezier(T* aSink, const Point &aOrigin, const Size &aRadius)
{
  Point startPoint(aOrigin.x + aRadius.width,
                   aOrigin.y);

  aSink->LineTo(startPoint);

  // Calculate kappa constant for partial curve. The sign of angle in the
  // tangent will actually ensure this is negative for a counter clockwise
  // sweep, so changing signs later isn't needed.
  Float kappaFactor = (4.0f / 3.0f) * tan((M_PI/2.0f) / 4.0f);
  Float kappaX = kappaFactor * aRadius.width;
  Float kappaY = kappaFactor * aRadius.height;
  Float cosStartAngle = 1;
  Float sinStartAngle = 0;
  for (int i = 0; i < 4; i++) {
    // We guarantee here the current point is the start point of the next
    // curve segment.
    Point currentStartPoint(aOrigin.x + cosStartAngle * aRadius.width,
                            aOrigin.y + sinStartAngle * aRadius.height);
    Point currentEndPoint(aOrigin.x + -sinStartAngle * aRadius.width,
                          aOrigin.y + cosStartAngle * aRadius.height);

    Point tangentStart(-sinStartAngle, cosStartAngle);
    Point cp1 = currentStartPoint;
    cp1 += Point(tangentStart.x * kappaX, tangentStart.y * kappaY);

    Point revTangentEnd(cosStartAngle, sinStartAngle);
    Point cp2 = currentEndPoint;
    cp2 += Point(revTangentEnd.x * kappaX, revTangentEnd.y * kappaY);

    aSink->BezierTo(cp1, cp2, currentEndPoint);

    // cos(x+pi/2) == -sin(x)
    // sin(x+pi/2) == cos(x)
    Float tmp = cosStartAngle;
    cosStartAngle = -sinStartAngle;
    sinStartAngle = tmp;
  }
}

/**
 * Appends a path represending a rounded rectangle to the path being built by
 * aPathBuilder.
 *
 * aRect           The rectangle to append.
 * aCornerRadii    Contains the radii of the top-left, top-right, bottom-right
 *                 and bottom-left corners, in that order.
 * aDrawClockwise  If set to true, the path will start at the left of the top
 *                 left edge and draw clockwise. If set to false the path will
 *                 start at the right of the top left edge and draw counter-
 *                 clockwise.
 */
GFX2D_API void AppendRoundedRectToPath(PathBuilder* aPathBuilder,
                                       const Rect& aRect,
                                       const Size(& aCornerRadii)[4],
                                       bool aDrawClockwise = true);

/**
 * Appends a path represending an ellipse to the path being built by
 * aPathBuilder.
 *
 * The ellipse extends aDimensions.width / 2.0 in the horizontal direction
 * from aCenter, and aDimensions.height / 2.0 in the vertical direction.
 */
GFX2D_API void AppendEllipseToPath(PathBuilder* aPathBuilder,
                                   const Point& aCenter,
                                   const Size& aDimensions);

static inline bool
UserToDevicePixelSnapped(Rect& aRect, const Matrix& aTransform)
{
  Point p1 = aTransform * aRect.TopLeft();
  Point p2 = aTransform * aRect.TopRight();
  Point p3 = aTransform * aRect.BottomRight();

  // Check that the rectangle is axis-aligned. For an axis-aligned rectangle,
  // two opposite corners define the entire rectangle. So check if
  // the axis-aligned rectangle with opposite corners p1 and p3
  // define an axis-aligned rectangle whose other corners are p2 and p4.
  // We actually only need to check one of p2 and p4, since an affine
  // transform maps parallelograms to parallelograms.
  if (p2 == Point(p1.x, p3.y) || p2 == Point(p3.x, p1.y)) {
      p1.Round();
      p3.Round();

      aRect.MoveTo(Point(std::min(p1.x, p3.x), std::min(p1.y, p3.y)));
      aRect.SizeTo(Size(std::max(p1.x, p3.x) - aRect.X(),
                        std::max(p1.y, p3.y) - aRect.Y()));
      return true;
  }

  return false;
}

} // namespace gfx
} // namespace mozilla

#endif /* MOZILLA_GFX_PATHHELPERS_H_ */
