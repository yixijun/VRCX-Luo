using System;
using System.Numerics;
using System.Text;
using Valve.VR;

namespace VRCX;

/// <summary>
/// Resolves the controller component pose used by the wrist pointer. The
/// neutral trigger pose is frozen relative to the device, so squeezing the trigger
/// cannot change the ray origin or direction. The resolver
/// keeps the device model lookup out of the per-frame ray math and falls back
/// to the legacy device pose when a runtime does not expose render-model
/// components.
/// </summary>
internal sealed class WristPointerPoseResolver
{
    private static readonly TimeSpan ModelRefreshInterval = TimeSpan.FromSeconds(1);
    private const string TriggerComponentName = "trigger";

    private readonly StringBuilder _renderModelNameBuffer = new(256);
    private uint _deviceIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
    private ETrackedControllerRole _role = ETrackedControllerRole.Invalid;
    private string _renderModelName = string.Empty;
    private HmdMatrix34_t _aimPose;
    private bool _hasAimPose;
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

        if (_hasAimPose)
        {
            tipPose = _aimPose;
            return true;
        }

        var renderModels = OpenVR.RenderModels;
        if (renderModels == null)
        {
            return false;
        }

        EnsureInputSourceHandle();
        var controllerModeState = new RenderModel_ControllerMode_State_t();
        var componentState = new RenderModel_ComponentState_t();
        // Query a neutral trigger instead of its animated pressed transform.
        var neutralState = new VRControllerState_t();
        return TryGetStablePose(componentName =>
        {
            return TryGetComponentState(renderModels, componentName,
                componentName == TriggerComponentName ? 0 : _inputSourceHandle,
                ref neutralState, ref controllerModeState, ref componentState)
                ? componentState.mTrackingToComponentLocal
                : null;
        }, out tipPose);
    }

    internal bool TryGetStablePose(Func<string, HmdMatrix34_t?> readPose, out HmdMatrix34_t tipPose)
    {
        tipPose = _aimPose;
        if (_hasAimPose)
            return true;
        var componentNames = new[]
        {
            TriggerComponentName,
            OpenVR.k_pch_Controller_Component_Tip
        };
        foreach (var componentName in componentNames)
        {
            var pose = readPose(componentName);
            if (!pose.HasValue)
            {
                continue;
            }

            var candidate = pose.Value;
            if (!WristPointerMath.TryNormalizeRay(
                    new Vector3(candidate.m3, candidate.m7, candidate.m11),
                    new Vector3(-candidate.m2, -candidate.m6, -candidate.m10), out _))
                continue;

            tipPose = pose.Value;
            _aimPose = tipPose;
            _hasAimPose = true;
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
        _hasAimPose = false;
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
            _hasAimPose = false;
            _inputSourceHandle = 0;
            _inputSourceLookupAttempted = false;
        }
    }

    private bool TryGetComponentState(
        CVRRenderModels renderModels,
        string componentName,
        ulong inputSourceHandle,
        ref VRControllerState_t controllerState,
        ref RenderModel_ControllerMode_State_t controllerModeState,
        ref RenderModel_ComponentState_t componentState
    )
    {
        if (inputSourceHandle != 0 && renderModels.GetComponentStateForDevicePath(
                _renderModelName,
                componentName,
                inputSourceHandle,
                ref controllerModeState,
                ref componentState))
        {
            return true;
        }

        // Keep support for runtimes that do not expose input source handles.
        return renderModels.GetComponentState(
            _renderModelName,
            componentName,
            ref controllerState,
            ref controllerModeState,
            ref componentState
        );
    }

    private void EnsureInputSourceHandle()
    {
        if (_inputSourceLookupAttempted)
        {
            return;
        }

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
            _inputSourceLookupAttempted = true;
        }
    }
}
