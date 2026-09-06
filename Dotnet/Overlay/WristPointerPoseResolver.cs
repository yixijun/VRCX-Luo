using System;
using System.Text;
using Valve.VR;

namespace VRCX;

/// <summary>
/// Resolves the controller component pose used by the wrist pointer. The
/// physical trigger component is preferred so the ray follows the trigger's
/// position and direction; SteamVR's canonical tip pose is the compatibility
/// fallback for models that do not expose a trigger component. The resolver
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
    private string _pointerComponentName = string.Empty;
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
        if (!string.IsNullOrEmpty(_pointerComponentName) && TryGetComponentState(
                renderModels,
                _pointerComponentName,
                _inputSourceHandle,
                ref controllerState,
                ref controllerModeState,
                ref componentState))
        {
            tipPose = componentState.mTrackingToComponentLocal;
            return true;
        }

        // Prefer the physical trigger so pointer origin and direction match
        // the control the user is pressing. The tip pose remains the fallback
        // for controller models which do not expose a trigger component.
        var componentNames = new[]
        {
            TriggerComponentName,
            OpenVR.k_pch_Controller_Component_Tip
        };
        foreach (var componentName in componentNames)
        {
            if (!TryGetComponentState(
                    renderModels,
                    componentName,
                    _inputSourceHandle,
                    ref controllerState,
                    ref controllerModeState,
                    ref componentState))
            {
                continue;
            }

            _pointerComponentName = componentName;
            tipPose = componentState.mTrackingToComponentLocal;
            return true;
        }

        _pointerComponentName = string.Empty;
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
        _pointerComponentName = string.Empty;
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
            _pointerComponentName = string.Empty;
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
