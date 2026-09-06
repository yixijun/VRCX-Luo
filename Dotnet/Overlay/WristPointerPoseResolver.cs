using System;
using System.Text;
using Valve.VR;

namespace VRCX;

/// <summary>
/// Resolves the controller's render-model tip pose, which SteamVR defines as
/// the controller's aim/pointer pose. The resolver keeps the device model
/// lookup out of the per-frame ray math and falls back to the legacy device
/// pose when a runtime does not expose render-model components.
/// </summary>
internal sealed class WristPointerPoseResolver
{
    private static readonly TimeSpan ModelRefreshInterval = TimeSpan.FromSeconds(1);

    private readonly StringBuilder _renderModelNameBuffer = new(256);
    private uint _deviceIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
    private ETrackedControllerRole _role = ETrackedControllerRole.Invalid;
    private string _renderModelName = string.Empty;
    private ulong _inputSourceHandle;
    private bool _inputSourceLookupAttempted;
    private DateTime _nextModelRefresh = DateTime.MinValue;

    public bool TryGetTipPose(
        CVRSystem system,
        uint deviceIndex,
        ETrackedControllerRole role,
        ref VRControllerState_t controllerState,
        out HmdMatrix34_t tipPose
    )
    {
        tipPose = default;
        if (system == null)
        {
            return false;
        }

        if (_deviceIndex != deviceIndex || _role != role)
        {
            ResetForDevice(deviceIndex, role);
        }

        if (DateTime.UtcNow >= _nextModelRefresh)
        {
            RefreshRenderModelName(system);
        }

        if (string.IsNullOrEmpty(_renderModelName))
        {
            return false;
        }

        var renderModels = OpenVR.RenderModels;
        if (renderModels == null)
        {
            return false;
        }

        EnsureInputSourceHandle();
        var controllerModeState = new RenderModel_ControllerMode_State_t();
        var componentState = new RenderModel_ComponentState_t();
        if (_inputSourceHandle != 0 && renderModels.GetComponentStateForDevicePath(
                _renderModelName,
                OpenVR.k_pch_Controller_Component_Tip,
                _inputSourceHandle,
                ref controllerModeState,
                ref componentState))
        {
            tipPose = componentState.mTrackingToComponentLocal;
            return true;
        }

        // Keep support for runtimes that do not expose input source handles.
        if (renderModels.GetComponentState(
                _renderModelName,
                OpenVR.k_pch_Controller_Component_Tip,
                ref controllerState,
                ref controllerModeState,
                ref componentState))
        {
            tipPose = componentState.mTrackingToComponentLocal;
            return true;
        }

        return false;
    }

    public void Reset()
    {
        ResetForDevice(OpenVR.k_unTrackedDeviceIndexInvalid, ETrackedControllerRole.Invalid);
    }

    private void ResetForDevice(uint deviceIndex, ETrackedControllerRole role)
    {
        _deviceIndex = deviceIndex;
        _role = role;
        _renderModelName = string.Empty;
        _inputSourceHandle = 0;
        _inputSourceLookupAttempted = false;
        _nextModelRefresh = DateTime.MinValue;
    }

    private void RefreshRenderModelName(CVRSystem system)
    {
        _nextModelRefresh = DateTime.UtcNow.Add(ModelRefreshInterval);
        _renderModelNameBuffer.Clear();
        var error = ETrackedPropertyError.TrackedProp_Success;
        system.GetStringTrackedDeviceProperty(
            _deviceIndex,
            ETrackedDeviceProperty.Prop_RenderModelName_String,
            _renderModelNameBuffer,
            (uint)_renderModelNameBuffer.Capacity,
            ref error
        );

        var renderModelName = error == ETrackedPropertyError.TrackedProp_Success
            ? _renderModelNameBuffer.ToString().TrimEnd('\0')
            : string.Empty;
        if (!string.Equals(_renderModelName, renderModelName, StringComparison.Ordinal))
        {
            _renderModelName = renderModelName;
            _inputSourceHandle = 0;
            _inputSourceLookupAttempted = false;
        }
    }

    private void EnsureInputSourceHandle()
    {
        if (_inputSourceLookupAttempted)
        {
            return;
        }

        _inputSourceLookupAttempted = true;
        var input = OpenVR.Input;
        if (input == null)
        {
            return;
        }

        var path = _role == ETrackedControllerRole.RightHand
            ? OpenVR.k_pchPathUserHandRight
            : OpenVR.k_pchPathUserHandLeft;
        ulong inputSourceHandle = 0;
        if (input.GetInputSourceHandle(path, ref inputSourceHandle) == EVRInputError.None)
        {
            _inputSourceHandle = inputSourceHandle;
        }
    }
}
