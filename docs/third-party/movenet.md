# MoveNet model notice

The WeChat motion games can download the MoveNet SinglePose Lightning v4 ONNX model at runtime.

- Original model: Google MoveNet SinglePose Lightning v4
- ONNX conversion: Kazuhito Takahashi, `MoveNet-Python-Example`
- Source: <https://github.com/Kazuhito00/MoveNet-Python-Example>
- License: Apache License 2.0

The application proxy pins commit `515743a113e49b4f31677b1f6252c0041f237e30` and verifies the expected response size before serving the model.
