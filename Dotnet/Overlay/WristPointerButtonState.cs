namespace VRCX;

internal sealed class WristPointerButtonState
{
    private bool _armed;
    public bool IsPressed { get; private set; }

    public bool Update(bool valid, bool digitalPressed, float analog, bool hit)
    {
        if (!valid)
        {
            _armed = false;
            return false;
        }
        var pressed = digitalPressed || analog >= (IsPressed ? 0.4f : 0.55f);
        if (!pressed)
        {
            IsPressed = false;
            _armed = true;
            return false;
        }
        var click = !IsPressed && _armed && hit;
        IsPressed = true;
        return click;
    }

    public void Reset()
    {
        IsPressed = false;
        _armed = false;
    }
}
